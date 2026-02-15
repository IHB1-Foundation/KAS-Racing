# Thumbnail Screenshot Guide

## Requirements

- **Minimum Resolution**: 1280x720 (720p)
- **Recommended**: 1920x1080 (1080p) or 2560x1440 (1440p)
- **Format**: PNG or JPG
- **Location**: `docs/screenshots/` directory

## Capture Checklist

### Ideal Screenshot Content

The thumbnail should show:
1. **Game in action** - Runner mid-gameplay, obstacles visible
2. **TX Timeline** - At least 2 stages lit (Broadcasted → Accepted)
3. **HUD stats** - Speed, distance, checkpoints visible
4. **Wallet connected** - Address visible in header

### Screenshot Composition

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo/Title]                    [Wallet: 0x1234...abcd]   │
├───────────────────────────────────┬─────────────────────────┤
│                                   │  Speed: 450 km/h        │
│                                   │  Distance: 12,500m      │
│        GAME CANVAS                │  Checkpoints: 3         │
│     (Runner in mid-action)        │                         │
│                                   │  TX Timeline:           │
│     [Checkpoint visible]          │  ✓ Broadcasted  0ms     │
│     [Obstacles ahead]             │  ✓ Accepted    +850ms   │
│                                   │  ○ Included             │
│                                   │  ○ Confirmed            │
└───────────────────────────────────┴─────────────────────────┘
```

## How to Capture

### macOS
- **Full screen**: Cmd + Shift + 3
- **Selection**: Cmd + Shift + 4
- **Window**: Cmd + Shift + 4, then Space, then click window

### Windows
- **Full screen**: Win + PrtScn
- **Selection**: Win + Shift + S

### Browser DevTools
```javascript
// In console, for precise dimensions:
window.resizeTo(1920, 1080);
```

## Steps

1. Start the game with `pnpm dev`
2. Connect your EVM wallet (MetaMask)
3. Start Free Run mode
4. Play until you have:
   - At least 2 checkpoints collected
   - Speed above 400 km/h
   - TX Timeline showing multiple stages
5. Take screenshot at a visually interesting moment:
   - Checkpoint being collected
   - Near-miss with obstacle
   - High speed indicator visible

## Post-Processing (Optional)

### Add Overlay Text
- Game title: "KAS Racing"
- Tagline: "Real-time Kaspa Blockchain Gaming"
- Font: Sans-serif, white with drop shadow

### Image Optimization
```bash
# Convert to optimized PNG
pngquant --quality=80-90 screenshot.png

# Or to JPG
convert screenshot.png -quality 85 screenshot.jpg
```

## File Naming

```
docs/screenshots/
├── thumbnail_main.png      # Primary submission thumbnail
├── thumbnail_duel.png      # Duel mode screenshot (optional)
├── thumbnail_proof.png     # Proof page screenshot (optional)
└── gameplay_01.png         # Additional gameplay shots
```

## Example Usage

Once captured, reference in README:

```markdown
![KAS Racing Gameplay](docs/screenshots/thumbnail_main.png)
```
