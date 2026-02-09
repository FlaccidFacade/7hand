# Playing Card Component

## Overview

A self-contained Angular component that represents all 53 card types (52 standard playing cards + 1 joker) with interactive features including click-and-drag rotation and face flipping.

## Features

✅ **Complete Card Deck**
- Supports all 4 suits: Hearts (♥), Diamonds (♦), Clubs (♣), Spades (♠)
- Supports all 13 ranks: A, 2-10, J, Q, K
- Includes Joker card (53rd card type)
- Proper color coding (red for hearts/diamonds, black for clubs/spades)

✅ **Interactive Functionality**
- **Drag to Rotate**: Click and drag horizontally to spin the card
- **Double-Click to Flip**: Toggle between face up and face down
- **Touch Support**: Full mobile device support with touch gestures
- **Configurable**: Control draggable state and initial face direction

✅ **Responsive Design**
- Adapts to different screen sizes
- Mobile-optimized card sizes
- Proper touch event handling

✅ **Comprehensive Testing**
- 28 unit tests covering all functionality
- Tests for all 53 card types
- Mouse and touch interaction tests
- Edge case handling

## File Structure

```
frontend/src/app/components/playing-card/
├── playing-card.component.ts       # Component logic and interaction handling
├── playing-card.component.html     # Template with card layouts
├── playing-card.component.css      # Styling and responsive design
└── playing-card.component.spec.ts  # Unit tests (28 tests, all passing)
```

## Usage

### Basic Usage

```typescript
import { PlayingCardComponent } from './components/playing-card/playing-card.component';

@Component({
  // ...
  imports: [PlayingCardComponent]
})
```

```html
<app-playing-card 
  [suit]="'hearts'" 
  [rank]="'A'"
  [faceUp]="true"
  [draggable]="true">
</app-playing-card>
```

### Component Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `suit` | `Suit` | `'hearts'` | Card suit: 'hearts', 'diamonds', 'clubs', 'spades', or 'joker' |
| `rank` | `Rank` | `'A'` | Card rank: 'A', '2'-'10', 'J', 'Q', 'K', or 'JOKER' |
| `faceUp` | `boolean` | `true` | Whether the card shows its face or back |
| `draggable` | `boolean` | `true` | Whether the card can be rotated by dragging |

### Types

```typescript
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'joker';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'JOKER';
```

### Examples

**Ace of Spades (face up, draggable)**
```html
<app-playing-card 
  [suit]="'spades'" 
  [rank]="'A'"
  [faceUp]="true"
  [draggable]="true">
</app-playing-card>
```

**King of Hearts (face down, not draggable)**
```html
<app-playing-card 
  [suit]="'hearts'" 
  [rank]="'K'"
  [faceUp]="false"
  [draggable]="false">
</app-playing-card>
```

**Joker**
```html
<app-playing-card 
  [suit]="'joker'" 
  [rank]="'JOKER'"
  [faceUp]="true"
  [draggable]="true">
</app-playing-card>
```

## Interactive Features

### Double-Click to Flip
Double-click any card to toggle between face up and face down states.

### Drag to Rotate
Click and drag horizontally to rotate the card. The rotation is calculated based on the horizontal distance dragged.

### Touch Support
Full support for touch events on mobile devices:
- Touch and drag to rotate
- Double-tap to flip (uses standard double-click event)

## Component API

### Properties

- `rotation: number` - Current rotation angle in degrees
- `isDragging: boolean` - Whether the card is currently being dragged
- `cardId: string` - Unique identifier for the card (e.g., "A-spades")
- `suitSymbol: string` - Unicode symbol for the suit (♥, ♦, ♣, ♠, 🃏)
- `suitColor: string` - Color of the suit ('red' or 'black')
- `displayRank: string` - The rank to display on the card
- `isJoker: boolean` - Whether this card is the joker

### Methods

- `toggleFace(): void` - Flips the card between face up and face down
- `resetRotation(): void` - Resets the card rotation to 0 degrees

## Styling

The component uses scoped CSS with the following features:

- **Card dimensions**: 100px × 140px (desktop), responsive on mobile
- **Border radius**: 8px for rounded corners
- **Shadow**: Drop shadow for depth
- **Cursor states**: Grab cursor when hoverable, grabbing when dragging
- **Transitions**: Smooth rotation transitions
- **Responsive**: Scales down appropriately on tablets and phones

### CSS Classes

- `.playing-card` - Main card container
- `.dragging` - Applied when card is being dragged
- `.face-down` - Applied when card is face down
- `.joker` - Applied to joker cards for special styling

## Testing

All 28 unit tests pass successfully:

```bash
cd frontend
npm test -- --include='**/playing-card.component.spec.ts' --watch=false --browsers=ChromeHeadlessCI
```

### Test Coverage

- ✅ Component creation and initialization
- ✅ All 53 card types (52 standard + 1 joker)
- ✅ Suit symbols for all suits
- ✅ Suit colors (red/black)
- ✅ Joker identification
- ✅ Face toggle functionality
- ✅ Rotation functionality
- ✅ Mouse drag interaction
- ✅ Touch drag interaction
- ✅ Draggable state handling
- ✅ Edge cases and boundary conditions

## Demo Component

A demo component is included at `/card-demo` route that showcases:

- Interactive single card with controls
- Grid of all 53 card types
- Controls to change suit, rank, face direction, and draggable state

To view the demo:
1. Start the dev server: `npm start`
2. Navigate to: `http://localhost:4200/card-demo`

## Implementation Details

### Card Layouts

Each rank has a specific layout pattern for the suit symbols:

- **Ace**: Single centered symbol
- **2-10**: Arranged in standard playing card patterns
- **Jack/Queen/King**: Large letter in center
- **Joker**: Special emoji symbol with "JOKER" text

### Rotation Algorithm

The rotation is calculated based on horizontal drag distance:
```typescript
this.rotation = this.startRotation + (deltaX / 2);
```

This provides intuitive control where dragging right rotates clockwise and dragging left rotates counter-clockwise.

### Browser Compatibility

- Modern browsers with ES6+ support
- Touch events for mobile devices
- Pointer events fallback

## Future Enhancements

Possible additions for future iterations:

- Animation effects for flipping
- Sound effects
- Different card back designs
- Stacking/layering support
- Deck shuffling utilities
- Card dealing animations

## Related Files

- `/app/components/card-demo/` - Demo component showcasing all features
- `/app/app.routes.ts` - Route configuration including `/card-demo` route

## Notes

- The component is standalone and doesn't require any external dependencies beyond Angular core
- All interactions are handled within the component itself
- The component follows Angular best practices and coding standards
- CSS follows the project's existing styling patterns
