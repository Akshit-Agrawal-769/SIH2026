import os

files = [
    'src/components/analytics/AnalyticsModal.tsx',
    'src/components/comparison/ModelObservationModal.tsx',
    'src/components/InstrumentProfileModal.tsx'
]

for f in files:
    if not os.path.exists(f): 
        print("Not found: " + f)
        continue
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # UI chrome replacements
    content = content.replace('text-emerald-400', 'text-ocean-accent')
    content = content.replace('text-emerald-300', 'text-ocean-accent')
    content = content.replace('bg-emerald-400', 'bg-ocean-accent')
    content = content.replace('bg-emerald-500/20', 'bg-ocean-accent/20')
    content = content.replace('bg-emerald-500/30', 'bg-ocean-accent/30')
    content = content.replace('bg-emerald-500/40', 'bg-ocean-accent/40')
    content = content.replace('border-emerald-500/30', 'border-ocean-accent/30')
    content = content.replace('border-emerald-500/40', 'border-ocean-accent/40')
    content = content.replace('border-emerald-400/50', 'border-ocean-accent/50')
    content = content.replace('border-emerald-400/40', 'border-ocean-accent/40')
    content = content.replace('border-emerald-400', 'border-ocean-accent')
    content = content.replace('ring-emerald-400', 'ring-ocean-accent')
    
    # Glow replacements
    content = content.replace('glow-green', 'glow-accent')
    
    # Transitions
    content = content.replace('transition-all duration-200', 'transition-all duration-[150ms] ease-nasa')
    content = content.replace('transition-all', 'transition-all duration-[150ms] ease-nasa')
    content = content.replace('transition-colors', 'transition-colors duration-[150ms] ease-nasa')
    content = content.replace('transition duration-300', 'transition-all duration-[300ms] ease-nasa-slow')
    content = content.replace('transition"', 'transition-all duration-[150ms] ease-nasa"')
    content = content.replace('transition ', 'transition-all duration-[150ms] ease-nasa ')
    
    # Remove duplicate transition-all classes
    content = content.replace('transition-all duration-[150ms] ease-nasa duration-[150ms] ease-nasa', 'transition-all duration-[150ms] ease-nasa')
    
    content = content.replace('text-xs font-bold text-white uppercase tracking-wider', 'text-[10px] font-bold text-ocean-muted uppercase tracking-wider')

    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
print('UI Chrome updated for modals')
