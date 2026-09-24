import React, { useState, useEffect, useRef } from 'react';
import { useOceanStore } from '../store/useOceanStore';
import {
  Search,
  Share2,
  Check,
  MapPin,
  Loader2,
  Box,
  RotateCcw,
  PanelLeftClose,
  PanelRightClose,
  Eye,
  Layers,
  Home,
  Globe,
  Waves,
  BarChart3
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
    openWaterBlock,
    openAnalyticsModal
  } = useOceanStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationPreset[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowDropdown(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      setSearchResults(REGION_PRESETS.slice(0, 6));
      return;
    }

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
    <header className="fixed top-3 left-4 right-4 z-30 flex items-center justify-between pointer-events-none select-none gap-3">
      {/* Brand & Mission Badge */}
      <div className="flex items-center gap-3 pointer-events-auto shrink-0">
        <div
          onClick={() => setMode('operational')}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-ocean-panel border border-ocean-border backdrop-blur-sm cursor-pointer group shadow-xl transition-transform hover:scale-[1.02]"
          title="INCOIS Indian Ocean 3D Volumetric Digital Twin"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-ocean-accent/30 to-ocean-accent/30 border border-ocean-accent/40 flex items-center justify-center text-ocean-accent shadow-md">
            <Waves className="w-3.5 h-3.5 text-ocean-accent" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs tracking-tight text-white leading-none">
              Oceanix
            </span>
            <span className="text-[8px] font-mono text-ocean-accent tracking-wider uppercase mt-0.5">
              INCOIS TWIN
            </span>
          </div>
        </div>
      </div>

      {/* Search Pill Input */}
      <div ref={searchRef} className="relative w-72 sm:w-80 md:w-96 pointer-events-auto">
        <form onSubmit={handleOnlineGeocode} className="relative flex items-center">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => {
              if (!searchQuery.trim()) {
                setSearchResults(REGION_PRESETS.slice(0, 6));
              }
              setShowDropdown(true);
            }}
            placeholder="Search ocean data, regions, or parameters..."
            className="w-full bg-ocean-panel border border-ocean-border backdrop-blur-sm text-white placeholder:text-ocean-muted pl-9 pr-14 py-2 rounded-full text-xs focus:outline-none focus:ring-1 focus:ring-ocean-accent/50 transition-all duration-[150ms] ease-nasa shadow-xl"
          />
          <Search className="w-3.5 h-3.5 text-ocean-muted absolute left-3 pointer-events-none" />

          <div className="absolute right-3 flex items-center gap-1.5 pointer-events-none">
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 text-ocean-accent animate-spin" />
            ) : (
              <kbd className="text-[9px] font-mono text-ocean-muted bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
                ⌘K
              </kbd>
            )}
          </div>
        </form>

        {/* Search Results Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-xl overflow-hidden shadow-2xl z-40 max-h-72 overflow-y-auto p-1.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1 text-[10px] font-mono uppercase text-ocean-accent tracking-wider font-semibold">
              Presets &amp; Locations
            </div>
            {searchResults.map((loc, idx) => (
              <div
                key={`${loc.name}-${idx}`}
                onClick={() => selectLocation(loc)}
                className="px-3 py-2 hover:bg-white/10 rounded-xl cursor-pointer flex items-center justify-between transition-all duration-[150ms] ease-nasa"
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-3.5 h-3.5 text-ocean-accent shrink-0" />
                  <span className="text-xs text-ocean-text-secondary font-medium truncate max-w-[200px]">
                    {loc.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-ocean-muted uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                    {loc.category}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openWaterBlock({ lon: loc.lon, lat: loc.lat, name: `${loc.name} Water Column` });
                      setShowDropdown(false);
                    }}
                    className="px-2 py-0.5 rounded-full bg-ocean-accent/20 hover:bg-ocean-accent/30 text-ocean-accent border border-ocean-accent/40 text-[9px] font-mono flex items-center gap-1 transition-all duration-[150ms] ease-nasa"
                    title="Open 3D Volumetric Water Block"
                  >
                    <Box className="w-3 h-3 text-ocean-accent" />
                    <span>3D Cube</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Camera Presets (Quick Access) */}
      <div className="hidden xl:flex items-center gap-1.5 bg-ocean-panel border border-ocean-border backdrop-blur-sm px-2.5 py-1 rounded-full pointer-events-auto text-xs shadow-xl">
        <span className="text-[10px] text-ocean-muted font-mono uppercase mr-1">Camera:</span>
        <button
          onClick={handleResetHome}
          className="px-2.5 py-1 text-xs font-medium rounded-full bg-ocean-accent/20 border border-ocean-accent/40 text-ocean-accent hover:bg-ocean-accent/30 transition-all duration-[150ms] ease-nasa flex items-center gap-1"
          title="View entire Earth globe"
        >
          <Globe className="w-3 h-3" />
          <span>Entire Globe</span>
        </button>
        <button
          onClick={() => {
            if (!viewer) return;
            flyToCoordinates(viewer, { lon: 78.0, lat: 12.0, height: 6500000, pitch: -75.0 });
          }}
          className="px-2 py-1 text-xs rounded-full hover:bg-white/10 text-ocean-text-secondary hover:text-white transition-all duration-[150ms] ease-nasa"
        >
          Indian EEZ
        </button>
        <button
          onClick={() => {
            if (!viewer) return;
            flyToCoordinates(viewer, { lon: 88.0, lat: 14.5, height: 2800000, pitch: -70.0 });
          }}
          className="px-2 py-1 text-xs rounded-full hover:bg-white/10 text-ocean-text-secondary hover:text-white transition-all duration-[150ms] ease-nasa"
        >
          Bay of Bengal
        </button>
        <button
          onClick={() => {
            if (!viewer) return;
            flyToCoordinates(viewer, { lon: 66.0, lat: 16.0, height: 3200000, pitch: -70.0 });
          }}
          className="px-2 py-1 text-xs rounded-full hover:bg-white/10 text-ocean-text-secondary hover:text-white transition-all duration-[150ms] ease-nasa"
        >
          Arabian Sea
        </button>
        <div className="w-[1px] h-3.5 bg-white/10 mx-0.5" />
        <button
          onClick={() => {
            openWaterBlock({
              lon: 78.0,
              lat: 12.0,
              name: 'Indian Ocean Water Column'
            });
          }}
          className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-ocean-accent/30 to-ocean-accent/30 border border-ocean-accent/50 text-ocean-accent hover:from-ocean-accent/40 hover:to-ocean-accent/50 transition-all duration-[150ms] ease-nasa flex items-center gap-1 shadow-sm"
          title="Open 3D Volumetric Water Column Cube Studio (0–2000m)"
        >
          <Box className="w-3 h-3 text-ocean-accent" />
          <span>3D Ocean Cube</span>
        </button>

        <button
          onClick={() => {
            openAnalyticsModal();
          }}
          className="px-2.5 py-1 text-xs font-semibold rounded bg-gradient-to-r from-ocean-accent/20 to-ocean-accent/30 border border-ocean-accent/50 text-ocean-text-main hover:from-ocean-accent/35 hover:to-ocean-accent/45 transition-all duration-[150ms] ease-nasa flex items-center gap-1.5 shadow-md shadow-ocean-accent/20"
          title="Open Scientific Ocean Analytics Studio (Trends, Stratification, Anomalies, Correlations)"
        >
          <BarChart3 className="w-3.5 h-3.5 text-ocean-accent" />
          <span>Ocean Analytics</span>
        </button>
      </div>

      {/* Right Controls: Share Link, HUD Toggles, Reset, Mode Switch */}
      <div className="flex items-center gap-2 pointer-events-auto shrink-0">
        {/* Share View Permalink */}
        <button
          onClick={handleShareLink}
          title="Copy shareable permalink"
          className="h-9 px-3 rounded-full bg-ocean-panel border border-ocean-border backdrop-blur-sm flex items-center gap-1.5 text-xs text-ocean-text-secondary hover:text-white transition-all duration-[150ms] ease-nasa shadow-lg"
        >
          {copiedToast ? (
            <>
              <Check className="w-3.5 h-3.5 text-ocean-accent" />
              <span className="text-ocean-accent font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5 text-ocean-text-secondary" />
              <span className="hidden sm:inline font-medium">Share</span>
            </>
          )}
        </button>

        {/* HUD Panels Toggles */}
        {mode === 'operational' && (
          <div className="hidden sm:flex items-center gap-1 bg-ocean-panel border border-ocean-border backdrop-blur-sm px-1.5 py-1 rounded-full text-xs shadow-lg">
            <button
              onClick={toggleLeftPanel}
              title={showLeftPanel ? 'Hide Layers Panel' : 'Show Layers Panel'}
              className={`p-1.5 rounded-full transition-all duration-[150ms] ease-nasa ${
                showLeftPanel ? 'text-ocean-accent bg-white/10' : 'text-ocean-muted hover:text-ocean-text-secondary'
              }`}
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleRightPanel}
              title={showRightPanel ? 'Hide Controls Panel' : 'Show Controls Panel'}
              className={`p-1.5 rounded-full transition-all duration-[150ms] ease-nasa ${
                showRightPanel ? 'text-ocean-accent bg-white/10' : 'text-ocean-muted hover:text-ocean-text-secondary'
              }`}
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
            
          </div>
        )}

        {/* Reset Camera Button */}
        <button
          onClick={handleResetHome}
          title="Reset to Entire Globe"
          className="w-9 h-9 rounded-full bg-ocean-panel border border-ocean-border backdrop-blur-sm flex items-center justify-center text-ocean-text-secondary hover:text-white transition-all duration-[150ms] ease-nasa shadow-lg"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Home vs Operational vs Outreach Mode Switch */}
        <div className="flex items-center bg-ocean-panel border border-ocean-border backdrop-blur-sm p-1 rounded-full text-xs shadow-lg">
          <button
            onClick={() => setMode('home')}
            className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all duration-[150ms] ease-nasa ${
              mode === 'home'
                ? 'bg-white text-ocean-solid font-semibold shadow-sm'
                : 'text-ocean-muted hover:text-white'
            }`}
          >
            <Home className="w-3 h-3" />
            <span className="hidden md:inline">Home</span>
          </button>
          <button
            onClick={() => setMode('operational')}
            className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all duration-[150ms] ease-nasa ${
              mode === 'operational'
                ? 'bg-white text-ocean-solid font-semibold shadow-sm'
                : 'text-ocean-muted hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span className="hidden md:inline">Operational</span>
          </button>
          <button
            onClick={() => setMode('outreach')}
            className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all duration-[150ms] ease-nasa ${
              mode === 'outreach'
                ? 'bg-white text-ocean-solid font-semibold shadow-sm'
                : 'text-ocean-muted hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span className="hidden md:inline">Outreach</span>
          </button>
        </div>
      </div>
    </header>
  );
};


