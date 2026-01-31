import { useEffect, useState, useCallback, useRef, memo } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import type { Layer, Path } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PosteriorEstimate } from '../lib/supabase';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

interface PrecinctProperties {
  geo_id: string;
  precinct: string;
  neighborhood: string;
  district: string;
  mu_prior: number;
  turnout_2024: number;
  turnout_2022: number;
}

interface TurnoutMapProps {
  posteriors: Map<string, PosteriorEstimate>;
  onSelect: (geoId: string) => void;
  selected: string | null;
  recentlyUpdated?: Set<string>;
}

/**
 * SEMANTIC COLOR LOGIC:
 * - Cyan represents civic signal, participation intensity, turnout energy
 * - Every precinct shows cyan based on historical baseline (mu_prior)
 * - Live signals SHIFT intensity, they don't CREATE it
 * - Gray is structural context only, never replaces cyan where turnout exists
 */
function getTurnoutColor(
  muPrior: number,
  posterior: PosteriorEstimate | undefined,
  isRecentlyUpdated: boolean
): string {
  // Flash bright cyan on live signal arrival
  if (isRecentlyUpdated) return '#00FFFF';

  // Base turnout: use posterior estimate if calibrated, otherwise historical baseline
  // Key insight: mu_prior ALWAYS exists, so we ALWAYS have signal
  const hasLiveCalibration = posterior?.is_visible ?? false;
  const turnout = hasLiveCalibration
    ? (posterior?.mu_post ?? muPrior)
    : muPrior;

  // Map turnout (typically 0.3 to 0.8 in SF) to cyan intensity
  // Every precinct gets cyan - darker for low turnout, brighter for high
  const normalized = Math.max(0, Math.min(1, (turnout - 0.25) / 0.55));

  // Cyan color scale - ALWAYS cyan, never grey for precincts with data
  if (normalized >= 0.85) return '#00E5FF';  // Very high - bright cyan
  if (normalized >= 0.7) return '#22D3EE';   // High
  if (normalized >= 0.55) return '#06B6D4';  // Medium-high
  if (normalized >= 0.4) return '#0891B2';   // Medium
  if (normalized >= 0.25) return '#0E7490';  // Medium-low
  if (normalized >= 0.1) return '#155E75';   // Low
  return '#164E63';                           // Very low - still cyan, just dark
}

/**
 * OPACITY = CONFIDENCE
 * - Base opacity from historical data (always present)
 * - Live signals increase confidence (higher opacity)
 * - Precincts without live signals still visible, just less confident
 */
function getOpacity(posterior: PosteriorEstimate | undefined, isRecentlyUpdated: boolean): number {
  if (isRecentlyUpdated) return 0.95;

  const hasLiveCalibration = posterior?.is_visible ?? false;
  const responses = posterior?.n_eff ?? 0;

  // Base opacity: 0.55 for historical baseline
  // Live calibration increases confidence
  if (hasLiveCalibration) {
    // More responses = more confident = more opaque
    return Math.min(0.9, 0.6 + responses * 0.025);
  }

  // No live signals yet, but still show with moderate opacity
  // Map is alive even at zero submissions
  return 0.55;
}

/**
 * Border glow for high-turnout areas
 * Uses historical baseline, enhanced by live calibration
 */
function getGlowIntensity(posterior: PosteriorEstimate | undefined, muPrior: number): number {
  const hasLiveCalibration = posterior?.is_visible ?? false;
  const turnout = hasLiveCalibration
    ? (posterior?.mu_post ?? muPrior)
    : muPrior;

  // High turnout areas glow even without live signals
  // Live calibration makes glow slightly more intense
  const boost = hasLiveCalibration ? 0.1 : 0;

  if (turnout >= 0.7) return 0.5 + boost;
  if (turnout >= 0.6) return 0.25 + boost;
  return 0;
}

function TurnoutMap({ posteriors, onSelect, selected, recentlyUpdated = new Set() }: TurnoutMapProps) {
  const [geo, setGeo] = useState<FeatureCollection | null>(null);
  const [geoKey, setGeoKey] = useState(0);
  const prevPosteriorsRef = useRef<Map<string, PosteriorEstimate>>(new Map());
  const layerRefs = useRef<Map<string, Path>>(new Map());

  useEffect(() => {
    fetch('/sf_precincts.geojson').then(r => r.json()).then(setGeo);
  }, []);

  // Track changed precincts and trigger pulse animation
  useEffect(() => {
    const changedGeoIds: string[] = [];

    posteriors.forEach((current, geoId) => {
      const prev = prevPosteriorsRef.current.get(geoId);
      if (!prev || prev.n_eff !== current.n_eff || prev.mu_post !== current.mu_post) {
        changedGeoIds.push(geoId);
      }
    });

    // Trigger pulse animation on changed layers
    changedGeoIds.forEach(geoId => {
      const layer = layerRefs.current.get(geoId);
      if (layer) {
        const element = layer.getElement?.();
        if (element) {
          // Add signal pulse animation class
          element.classList.add('precinct-signal-pulse');
          setTimeout(() => element.classList.remove('precinct-signal-pulse'), 1500);
        }
      }
    });

    prevPosteriorsRef.current = new Map(posteriors);
    setGeoKey(prev => prev + 1);
  }, [posteriors]);

  // Also animate recently updated precincts from external source
  useEffect(() => {
    recentlyUpdated.forEach(geoId => {
      const layer = layerRefs.current.get(geoId);
      if (layer) {
        const element = layer.getElement?.();
        if (element) {
          element.classList.add('precinct-signal-pulse');
          setTimeout(() => element.classList.remove('precinct-signal-pulse'), 1500);
        }
      }
    });
  }, [recentlyUpdated]);

  const style = useCallback((feature: Feature<Geometry, PrecinctProperties> | undefined) => {
    if (!feature) return {};
    const props = feature.properties;
    const geoId = props.geo_id;
    const p = posteriors.get(geoId);
    // Use mu_prior from posterior estimates (election-type-specific), fallback to GeoJSON
    const muPrior = p?.mu_prior ?? props.mu_prior;
    const isSelected = geoId === selected;
    const isRecentlyUpdated = recentlyUpdated.has(geoId);
    const glowIntensity = getGlowIntensity(p, muPrior);

    return {
      // Color from historical baseline, shifted by live signals
      fillColor: getTurnoutColor(muPrior, p, isRecentlyUpdated),
      fillOpacity: getOpacity(p, isRecentlyUpdated),
      color: isSelected
        ? '#00FFFF'
        : isRecentlyUpdated
          ? '#00FFFF'
          : glowIntensity > 0
            ? `rgba(0, 255, 255, ${glowIntensity})`
            : '#0F172A',
      weight: isSelected ? 2.5 : isRecentlyUpdated ? 2 : glowIntensity > 0 ? 1 : 0.5,
      className: isRecentlyUpdated ? 'precinct-updating' : '',
    };
  }, [posteriors, selected, recentlyUpdated]);

  const onEachFeature = useCallback((feature: Feature<Geometry, PrecinctProperties>, layer: Layer) => {
    const props = feature.properties;
    const pathLayer = layer as Path;
    const p = posteriors.get(props.geo_id);
    // Use mu_prior from posterior estimates (election-type-specific), fallback to GeoJSON
    const muPrior = p?.mu_prior ?? props.mu_prior;

    // Store layer reference for pulse animations
    layerRefs.current.set(props.geo_id, pathLayer);

    const hasLiveCalibration = p?.is_visible ?? false;
    const turnout = hasLiveCalibration ? (p?.mu_post ?? muPrior) : muPrior;
    const responses = p?.n_eff ?? 0;

    // Turnout status - always based on current expectation
    const getTurnoutLabel = (t: number) => {
      if (t >= 0.7) return 'High turnout expected';
      if (t >= 0.5) return 'Moderate turnout';
      return 'Lower turnout expected';
    };

    // Calibration status
    const calibrationLabel = hasLiveCalibration
      ? `Calibrated (${responses} signals)`
      : 'Historical baseline';

    const tooltipContent = `
      <div class="tooltip-neighborhood">${props.neighborhood}</div>
      <div style="display: grid; grid-template-columns: auto auto; gap: 6px 16px; font-size: 11px;">
        <span class="tooltip-label">Precinct</span>
        <span style="color: #e2e8f0; font-family: ui-monospace, monospace;">${props.precinct}</span>
        <span class="tooltip-label">District</span>
        <span style="color: #e2e8f0;">${props.district}</span>
        <span class="tooltip-label">Historical</span>
        <span class="tooltip-value">${(muPrior * 100).toFixed(1)}%</span>
        <span class="tooltip-label">Current Est.</span>
        <span class="tooltip-value">${(turnout * 100).toFixed(1)}%</span>
        <span class="tooltip-label">Expectation</span>
        <span style="color: #22d3ee; font-weight: 500;">${getTurnoutLabel(turnout)}</span>
        <span class="tooltip-label">Source</span>
        <span style="color: ${hasLiveCalibration ? '#22d3ee' : '#64748b'};">${calibrationLabel}</span>
      </div>
    `;

    layer.bindTooltip(tooltipContent, {
      sticky: true,
      className: 'leaflet-tooltip',
      direction: 'top',
      offset: [0, -10],
    });

    layer.on('click', () => onSelect(props.geo_id));

    // Hover effect
    layer.on('mouseover', () => {
      pathLayer.setStyle({
        weight: 2,
        color: 'rgba(0, 255, 255, 0.7)',
      });
    });

    layer.on('mouseout', () => {
      const p = posteriors.get(props.geo_id);
      const isSelected = props.geo_id === selected;
      const isRecentlyUpdated = recentlyUpdated.has(props.geo_id);
      const glowIntensity = getGlowIntensity(p, muPrior);

      pathLayer.setStyle({
        weight: isSelected ? 2.5 : isRecentlyUpdated ? 2 : glowIntensity > 0 ? 1 : 0.5,
        color: isSelected
          ? '#00FFFF'
          : isRecentlyUpdated
            ? '#00FFFF'
            : glowIntensity > 0
              ? `rgba(0, 255, 255, ${glowIntensity})`
              : '#0F172A',
      });
    });
  }, [posteriors, onSelect, selected, recentlyUpdated]);

  if (!geo) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0A0D10]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-700 border-t-cyan-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Initializing map…</p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={[37.7749, -122.4194]}
      zoom={12}
      className="h-full w-full"
      scrollWheelZoom={true}
      zoomControl={true}
    >
      {/* Dark base map - CartoDB Dark Matter */}
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <GeoJSON
        key={geoKey}
        data={geo}
        style={style as any}
        onEachFeature={onEachFeature as any}
      />
    </MapContainer>
  );
}

export default memo(TurnoutMap);
