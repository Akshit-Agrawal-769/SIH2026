import React, { useState, useEffect, useRef } from 'react';
import { useOceanStore } from '../store/useOceanStore';
import {
  Compass,
  RotateCcw,
  Eye,
  Layers,
  Globe,
  SlidersHorizontal,
  PanelLeftClose,
  PanelRightClose,
  Search,
  Share2,
  Check,
  MapPin,
  Loader2
} from 'lucide-react';
import * as Cesium from 'cesium';
import { flyToCoordinates } from '../globe/cameraUtils';
import { getShareableLink } from '../store/urlState';

interface TopBarProps {
  viewer: Cesium.Viewer | null;
}

interface LocationPreset {
  name: string;
  category: string;
  lon: number;
  lat: number;
  height: number;
  pitch?: number;
}

const REGION_PRESETS: LocationPreset[] = [
  { name: 'Entire Globe', category: 'Global', lon: 78.0, lat: 15.0, height: 24000000, pitch: -90.0 },
  { name: 'Indian EEZ', category: 'Maritime Zone', lon: 78.0, lat: 12.0, height: 6500000, pitch: -75.0 },
  { name: 'Bay of Bengal', category: 'Sea / Basin', lon: 88.0, lat: 14.5, height: 2800000, pitch: -70.0 },
  { name: 'Arabian Sea', category: 'Sea / Basin', lon: 66.0, lat: 16.0, height: 3200000, pitch: -70.0 },
  { name: 'Andaman & Nicobar', category: 'Island Zone', lon: 93.0, lat: 10.5, height: 1800000, pitch: -65.0 },
  { name: 'Lakshadweep Sea', category: 'Island Zone', lon: 72.5, lat: 10.5, height: 1200000, pitch: -65.0 },
  { name: 'Equatorial Indian Ocean', category: 'Ocean Basin', lon: 78.0, lat: 0.0, height: 4800000, pitch: -75.0 },
  { name: 'Chennai Coast (INCOIS Data)', category: 'Coastline', lon: 80.3, lat: 13.1, height: 50000, pitch: -55.0 },
  { name: 'Mumbai Offshore', category: 'Coastline', lon: 72.5, lat: 18.9, height: 50000, pitch: -55.0 },
  { name: 'Kochi (Malabar Coast)', category: 'Coastline', lon: 76.2, lat: 9.9, height: 50000, pitch: -55.0 },
  { name: 'Visakhapatnam Coast', category: 'Coastline', lon: 83.3, lat: 17.7, height: 50000, pitch: -55.0 }
];

export const TopBar: React.FC<TopBarProps> = ({ viewer }) => {
  const {
    mode,
    setMode,
    showLeftPanel,
    toggleLeftPanel,
    showRightPanel,
    toggleRightPanel,
    showBottomBar,
    toggleBottomBar
  } = useOceanStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationPreset[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    // Filter local preset library first for instant response
    const matchedPresets = REGION_PRESETS.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.category.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(matchedPresets);
    setShowDropdown(true);
  };

  const handleOnlineGeocode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Query OpenStreetMap Nominatim for global locations
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.length > 0) {
          const geocoded: LocationPreset[] = data.map((item: any) => ({
            name: item.display_name.split(',').slice(0, 2).join(','),
            category: item.type || 'Location',
            lon: parseFloat(item.lon),
            lat: parseFloat(item.lat),
            height: 150000,
            pitch: -60.0
          }));
          setSearchResults(geocoded);
          setShowDropdown(true);
        }
      }
    } catch (err) {
      console.warn('[Geocoding] OSM query failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectLocation = (loc: LocationPreset) => {
    if (!viewer) return;
    flyToCoordinates(viewer, {
      lon: loc.lon,
      lat: loc.lat,
      height: loc.height,
      pitch: loc.pitch,
      duration: 2.2
    });
    setSearchQuery(loc.name);
    setShowDropdown(false);
  };

  const handleResetHome = () => {
    if (!viewer) return;
    flyToCoordinates(viewer, {
      lon: 78.0,
      lat: 15.0,
      height: 24000000,
      pitch: -90.0,
      duration: 2.0
    });
  };

  const handleShareLink = () => {
    const link = getShareableLink();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2500);
      });
    }
  };

  return (
    <header className="absolute top-0 left-0 right-0 h-14 bg-ocean-dark/90 backdrop-blur-md border-b border-ocean-border z-30 flex items-center justify-between px-4">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
          <Compass className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wide text-white flex items-center gap-2">
            INCOIS <span className="text-ocean-accent">3D Ocean Platform</span>
          </h1>
          <p className="text-[10px] text-ocean-muted tracking-tight">
            Indian Ocean Digital Twin &amp; In-Situ Observations
          </p>
        </div>
      </div>

      {/* Geocoding Location Search */}
      <div ref={searchRef} className="relative w-64 md:w-80 lg:w-96">
        <form onSubmit={handleOnlineGeocode} className="relative flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim()) setShowDropdown(true);
            }}
            placeholder="Search location (e.g. Bay of Bengal, Kochi)..."
            className="w-full bg-ocean-panel/80 border border-ocean-border rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-100 placeholder-ocean-muted focus:outline-none focus:border-ocean-accent transition"
          />
          <Search className="w-4 h-4 text-ocean-muted absolute left-2.5 pointer-events-none" />
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-ocean-accent absolute right-2.5 animate-spin" />
          ) : null}
        </form>

        {/* Search Results Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-ocean-panel/95 backdrop-blur-md border border-ocean-border rounded-xl shadow-2xl overflow-hidden z-40 max-h-64 overflow-y-auto">
            {searchResults.map((loc, idx) => (
              <div
                key={`${loc.name}-${idx}`}
                onClick={() => selectLocation(loc)}
                className="px-3 py-2 hover:bg-ocean-border/60 cursor-pointer flex items-center justify-between border-b border-ocean-border/40 last:border-b-0 transition"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-ocean-accent shrink-0" />
                  <span className="text-xs text-slate-200 font-medium truncate max-w-[200px]">
                    {loc.name}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-ocean-muted uppercase px-1.5 py-0.5 rounded bg-ocean-dark/60">
                  {loc.category}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Camera Presets (Quick Access) */}
      <div className="hidden xl:flex items-center gap-2 bg-ocean-panel/80 px-2 py-1 rounded-md border border-ocean-border">
        <span className="text-[11px] text-ocean-muted font-mono uppercase mr-1">Camera:</span>
        <button
          onClick={handleResetHome}
          className="px-2.5 py-1 text-xs font-medium rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 transition flex items-center gap-1.5"
          title="View the entire spherical Earth"
        >
          <Globe className="w-3.5 h-3.5" />
          Entire Globe
        </button>
        <button
          onClick={() => {
            if (!viewer) return;
            flyToCoordinates(viewer, { lon: 78.0, lat: 12.0, height: 6500000, pitch: -75.0 });
          }}
          className="px-2 py-1 text-xs rounded hover:bg-ocean-border/60 text-slate-300 hover:text-white transition"
        >
          Indian EEZ
        </button>
        <button
          onClick={() => {
            if (!viewer) return;
            flyToCoordinates(viewer, { lon: 88.0, lat: 14.5, height: 2800000, pitch: -70.0 });
          }}
          className="px-2 py-1 text-xs rounded hover:bg-ocean-border/60 text-slate-300 hover:text-white transition"
        >
          Bay of Bengal
        </button>
        <button
          onClick={() => {
            if (!viewer) return;
            flyToCoordinates(viewer, { lon: 66.0, lat: 16.0, height: 3200000, pitch: -70.0 });
          }}
          className="px-2 py-1 text-xs rounded hover:bg-ocean-border/60 text-slate-300 hover:text-white transition"
        >
          Arabian Sea
        </button>
      </div>

      {/* Right Controls: Share Link, HUD Toggles, Mode Switch */}
      <div className="flex items-center gap-2.5">
        {/* Share View Permalink */}
        <button
          onClick={handleShareLink}
          title="Copy shareable permalink of current 3D view"
          className="p-2 rounded-md bg-ocean-panel border border-ocean-border hover:border-ocean-accent text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs"
        >
          {copiedToast ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-medium hidden sm:inline">Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </>
          )}
        </button>

        {/* Toggle HUD Panels for full-screen unobstructed view */}
        <div className="hidden sm:flex items-center gap-1 bg-ocean-panel p-1 rounded-lg border border-ocean-border text-xs">
          <button
            onClick={toggleLeftPanel}
            title={showLeftPanel ? 'Hide Layers Panel' : 'Show Layers Panel'}
            className={`p-1.5 rounded transition ${
              showLeftPanel ? 'text-ocean-accent bg-ocean-dark' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
          <button
            onClick={toggleRightPanel}
            title={showRightPanel ? 'Hide Controls Panel' : 'Show Controls Panel'}
            className={`p-1.5 rounded transition ${
              showRightPanel ? 'text-ocean-accent bg-ocean-dark' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
          <button
            onClick={toggleBottomBar}
            title={showBottomBar ? 'Hide Depth/Time Bar' : 'Show Depth/Time Bar'}
            className={`p-1.5 rounded transition ${
              showBottomBar ? 'text-ocean-accent bg-ocean-dark' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Reset Camera Button */}
        <button
          onClick={handleResetHome}
          title="Reset to Entire Globe"
          className="p-2 rounded-md bg-ocean-panel border border-ocean-border hover:border-ocean-accent text-slate-300 hover:text-white transition"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Operational vs Outreach Mode Switch */}
        <div className="flex items-center bg-ocean-panel p-1 rounded-lg border border-ocean-border text-xs">
          <button
            onClick={() => setMode('operational')}
            className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition ${
              mode === 'operational'
                ? 'bg-cyan-500 text-black font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Operational</span>
          </button>
          <button
            onClick={() => setMode('outreach')}
            className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition ${
              mode === 'outreach'
                ? 'bg-cyan-500 text-black font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Outreach</span>
          </button>
        </div>
      </div>
    </header>
  );
};
