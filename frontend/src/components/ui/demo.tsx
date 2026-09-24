"use client";

import { motion } from "framer-motion";
import { DotGlobeHero } from "@/components/ui/globe-hero";
import { ArrowRight, Zap, Waves } from "lucide-react";

interface DotGlobeHeroDemoProps {
  onStartExploring?: () => void;
  onViewDemo?: () => void;
}

export default function DotGlobeHeroDemo({
  onStartExploring,
  onViewDemo
}: DotGlobeHeroDemoProps = {}) {
  return (
    <DotGlobeHero
      rotationSpeed={0.004}
      className="bg-[#090b0d] relative overflow-hidden"
    >
      {/* Ambient background glows */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090b0d] via-transparent to-[#090b0d]/40 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-[140px] pointer-events-none" />
      
      <div className="relative z-10 text-center space-y-10 max-w-5xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          {/* Mission Pill Badge */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative inline-flex items-center gap-2.5 px-5 py-2 rounded-full glass-pill border border-emerald-500/30 shadow-2xl"
          >
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
            <span className="relative z-10 text-xs font-mono font-bold text-emerald-400 tracking-wider uppercase flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-emerald-400" />
              INCOIS 3D OCEAN DIGITAL TWIN
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </motion.div>
          
          <div className="space-y-4">
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] select-none text-white"
            >
              <span className="block font-light text-ocean-text-secondary text-3xl md:text-5xl lg:text-6xl mb-2">
                Explore the Depths of the
              </span>
              <span className="block relative">
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-teal-400 bg-clip-text text-transparent font-black relative z-10">
                  Indian Ocean
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-teal-400 to-teal-500 bg-clip-text text-transparent font-black blur-2xl opacity-40 scale-105">
                  Indian Ocean
                </div>
              </span>
            </motion.h1>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="max-w-2xl mx-auto space-y-3"
          >
            <p className="text-lg md:text-xl text-ocean-text-secondary leading-relaxed font-normal">
              High-resolution 4D volumetric visualization of hydrodynamic circulation, temperature, salinity, and in-situ autonomous sensor fleets.
            </p>
            <p className="text-xs font-mono text-ocean-muted">
              Coupled INCOIS HYCOM, NOAA VHR SST, Argo profiling floats &amp; deep-sea glider networks.
            </p>
          </motion.div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-2"
        >
          <motion.button
            onClick={onStartExploring}
            whileHover={{ 
              scale: 1.04, 
              boxShadow: "0 20px 40px rgba(34,197,94,0.25), 0 0 25px rgba(34,197,94,0.3)",
              y: -2
            }}
            whileTap={{ scale: 0.98 }}
            className="group relative inline-flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white rounded-full font-semibold text-base shadow-xl shadow-emerald-950/50 transition-all duration-300 overflow-hidden border border-emerald-400/40"
          >
            <span className="relative z-10 tracking-wide">Start Exploring</span>
            <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
          </motion.button>
          
          <motion.button
            onClick={onViewDemo}
            whileHover={{ 
              scale: 1.04,
              y: -2
            }}
            whileTap={{ scale: 0.98 }}
            className="group relative inline-flex items-center gap-2.5 px-7 py-3.5 glass-pill rounded-full font-semibold text-base text-ocean-text-secondary hover:text-white hover:border-emerald-400/40 transition-all duration-300 shadow-xl"
          >
            <Zap className="relative z-10 w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
            <span className="relative z-10 tracking-wide">Public Outreach Tour</span>
          </motion.button>
        </motion.div>
      </div>
    </DotGlobeHero>
  );
}
