import { useState, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

type Step = 'upload' | 'validating' | 'review' | 'running' | 'error';

interface PollCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPollCreated: (pollId: string, voterCount: number) => void;
}

interface ParsedVoter {
  phone_number: string;
  precinct: string;
  voter_name?: string;
}

interface ValidationResult {
  valid: boolean;
  voters: ParsedVoter[];
  precincts: string[];
  errors: string[];
}

// Fixed poll questions - non-editable
const POLL_QUESTIONS = [
  {
    id: 'neighbor_turnout',
    question: 'Do you believe most of your neighbors are going to vote in the 2026 midterm election?',
    options: [
      { value: 'almost_all', label: 'Almost all' },
      { value: 'most', label: 'Most' },
      { value: 'about_half', label: 'About half' },
      { value: 'probably_not', label: 'Probably not' },
      { value: 'definitely_not', label: 'Definitely not' },
    ],
  },
  {
    id: 'turnout_direction',
    question: 'Compared to the last midterm election, do you think turnout in your area will be higher or lower?',
    options: [
      { value: 'much_higher', label: 'Much higher' },
      { value: 'little_higher', label: 'A little higher' },
      { value: 'about_same', label: 'About the same' },
      { value: 'little_lower', label: 'A little lower' },
      { value: 'much_lower', label: 'Much lower' },
    ],
  },
  {
    id: 'vote_intent',
    question: 'Are you personally likely to vote in this midterm election?',
    options: [
      { value: 'definitely_yes', label: 'Definitely yes' },
      { value: 'probably_yes', label: 'Probably yes' },
      { value: 'not_sure', label: 'Not sure' },
      { value: 'probably_not', label: 'Probably not' },
      { value: 'definitely_not', label: 'Definitely not' },
    ],
  },
];

function PollCreationModal({ isOpen, onClose, onPollCreated }: PollCreationModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setStep('upload');
    setFile(null);
    setValidationResult(null);
    setErrorMessage('');
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const validateCSV = useCallback(async (csvFile: File): Promise<ValidationResult> => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.trim().split('\n');
        const errors: string[] = [];
        const voters: ParsedVoter[] = [];
        const precincts = new Set<string>();

        if (lines.length < 2) {
          resolve({
            valid: false,
            voters: [],
            precincts: [],
            errors: ['File must contain a header row and at least one data row'],
          });
          return;
        }

        // Parse header
        const header = lines[0].toLowerCase().split(',').map(h => h.trim());
        const phoneIndex = header.findIndex(h =>
          h === 'phone' || h === 'phone_number' || h === 'phonenumber'
        );
        const precinctIndex = header.findIndex(h =>
          h === 'precinct' || h === 'precinct_id' || h === 'geo_id'
        );
        const nameIndex = header.findIndex(h =>
          h === 'name' || h === 'voter_name' || h === 'first_name'
        );

        // Check required columns
        if (phoneIndex === -1) {
          errors.push('Missing required column: phone_number');
        }
        if (precinctIndex === -1) {
          errors.push('Missing required column: precinct');
        }

        if (errors.length > 0) {
          resolve({ valid: false, voters: [], precincts: [], errors });
          return;
        }

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(c => c.trim());
          if (row.length > 0 && row[phoneIndex]) {
            const phone = row[phoneIndex].replace(/[^\d+]/g, '');
            const precinct = row[precinctIndex];

            if (phone && precinct) {
              voters.push({
                phone_number: phone,
                precinct: precinct,
                voter_name: nameIndex >= 0 ? row[nameIndex] : undefined,
              });
              precincts.add(precinct);
            }
          }
        }

        if (voters.length === 0) {
          errors.push('No valid voter records found');
        }

        resolve({
          valid: errors.length === 0,
          voters,
          precincts: Array.from(precincts),
          errors,
        });
      };

      reader.onerror = () => {
        resolve({
          valid: false,
          voters: [],
          precincts: [],
          errors: ['Failed to read file'],
        });
      };

      reader.readAsText(csvFile);
    });
  }, []);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    // Validate file extension
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setErrorMessage('Only CSV files are allowed. Please upload a .csv file.');
      setStep('error');
      return;
    }

    setFile(selectedFile);
    setStep('validating');

    // Validate CSV contents
    const result = await validateCSV(selectedFile);
    setValidationResult(result);

    if (result.valid) {
      setStep('review');
    } else {
      setErrorMessage(result.errors.join('. '));
      setStep('error');
    }
  }, [validateCSV]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [handleFileSelect]);

  const handleRunPoll = useCallback(async () => {
    if (!validationResult?.valid) return;

    setStep('running');

    try {
      // Create the poll
      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .insert({
          name: file?.name.replace('.csv', '') || 'Untitled Poll',
          election_type: 'midterm_2026',
          status: 'active',
          voter_count: validationResult.voters.length,
          precinct_count: validationResult.precincts.length,
          created_by: user?.id,
        })
        .select()
        .single();

      if (pollError) throw pollError;

      // Insert voters in batches
      const batchSize = 100;
      for (let i = 0; i < validationResult.voters.length; i += batchSize) {
        const batch = validationResult.voters.slice(i, i + batchSize).map(v => ({
          poll_id: poll.id,
          phone_number: v.phone_number,
          precinct: v.precinct,
          voter_name: v.voter_name,
        }));

        const { error: voterError } = await supabase
          .from('poll_voters')
          .insert(batch);

        if (voterError) throw voterError;
      }

      // Success - return to dashboard
      onPollCreated(poll.id, validationResult.voters.length);
      handleClose();
    } catch (error) {
      console.error('Failed to create poll:', error);
      setErrorMessage('Failed to create poll. Please try again.');
      setStep('error');
    }
  }, [validationResult, file, onPollCreated, handleClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-[#12161C] rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden animate-fade-in-scale">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
          <div>
            <h2 className="text-lg font-semibold text-white">Create Poll</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === 'upload' && 'Step 1 of 2: Upload voter list'}
              {step === 'validating' && 'Validating...'}
              {step === 'review' && 'Step 2 of 2: Review and run'}
              {step === 'running' && 'Creating poll...'}
              {step === 'error' && 'Error'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-slate-300 mb-2">
                  Upload a voter list to create a perception poll.
                </p>
                <p className="text-xs text-slate-500">
                  CSV must include <code className="text-cyan-400">phone_number</code> and <code className="text-cyan-400">precinct</code> columns.
                </p>
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-cyan-500/50 hover:bg-slate-800/30 transition-all duration-200"
              >
                <Upload className="w-10 h-10 text-slate-500 mx-auto mb-4" />
                <p className="text-sm text-slate-300 mb-1">
                  Drop your CSV file here
                </p>
                <p className="text-xs text-slate-500">
                  or click to browse
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>

              {/* Format example */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
                  Required columns
                </p>
                <code className="text-xs text-cyan-400 font-mono">
                  phone_number, precinct
                </code>
                <p className="text-[11px] text-slate-500 mt-2">
                  Optional: voter_name, address, etc.
                </p>
              </div>
            </div>
          )}

          {/* Validating */}
          {step === 'validating' && (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 text-cyan-400 mx-auto mb-4 animate-spin" />
              <p className="text-sm text-slate-300">Validating voter list...</p>
              {file && (
                <p className="text-xs text-slate-500 mt-2">{file.name}</p>
              )}
            </div>
          )}

          {/* Step 2: Review Questions */}
          {step === 'review' && validationResult && (
            <div className="space-y-6">
              {/* Voter list summary */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm font-medium text-white">Voter list validated</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-mono font-semibold text-cyan-400">
                      {validationResult.voters.length.toLocaleString()}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Voters</p>
                  </div>
                  <div>
                    <p className="text-lg font-mono font-semibold text-cyan-400">
                      {validationResult.precincts.length}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Precincts</p>
                  </div>
                  <div>
                    <p className="text-lg font-mono font-semibold text-slate-400">3</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Questions</p>
                  </div>
                </div>
              </div>

              {/* Questions preview */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
                  Poll Questions (Fixed)
                </p>
                <div className="space-y-4 max-h-[280px] overflow-y-auto pr-2">
                  {POLL_QUESTIONS.map((q, i) => (
                    <div key={q.id} className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/40">
                      <p className="text-sm text-slate-300 mb-3">
                        <span className="text-cyan-400 font-mono mr-2">{i + 1}.</span>
                        {q.question}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((opt) => (
                          <span
                            key={opt.value}
                            className="px-2.5 py-1 text-xs text-slate-400 bg-slate-700/50 rounded-md"
                          >
                            {opt.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetState}
                  className="flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleRunPoll}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-black bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 transition-all hover:shadow-lg hover:shadow-cyan-500/20"
                >
                  Run Poll
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Running */}
          {step === 'running' && (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 text-cyan-400 mx-auto mb-4 animate-spin" />
              <p className="text-sm text-slate-300">Creating poll and uploading voters...</p>
              <p className="text-xs text-slate-500 mt-2">
                {validationResult?.voters.length.toLocaleString()} voters
              </p>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-white mb-1">
                  Validation failed
                </p>
                <p className="text-sm text-slate-400">
                  {errorMessage}
                </p>
              </div>

              {file && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <FileText className="w-4 h-4" />
                    {file.name}
                  </div>
                </div>
              )}

              <button
                onClick={resetState}
                className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default memo(PollCreationModal);
