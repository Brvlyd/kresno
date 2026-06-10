# UI Requirements

## Language
- **All UI text must be in Bahasa Indonesia**
- Error messages in Bahasa Indonesia
- Button labels, form fields, navigation in Bahasa Indonesia
- Comments in code can be English, but user-facing text must be Indonesian

## Design for Elderly Users (Ramah Lansia)

### Typography
- **Large font sizes** - minimum 16px for body text, 24px+ for headings
- **High contrast** - dark text on light backgrounds (AA accessibility minimum)
- **Clear, readable fonts** - avoid decorative fonts, use simple sans-serif

### Layout
- **Spacious design** - plenty of whitespace, avoid clutter
- **Large clickable areas** - buttons min 48x48px (touch-friendly)
- **Single column layouts** - avoid complex multi-column designs
- **Clear visual hierarchy** - obvious primary actions

### Navigation
- **Simple navigation** - clear labels, avoid nested menus
- **Breadcrumbs** - help users know where they are
- **Back buttons** - easy to return to previous screen
- **Consistent placement** - navigation in same place on every page

### Colors
- **High contrast ratios** (WCAG AA: 4.5:1 for normal text, 3:1 for large text)
- **Avoid color-only indicators** - use icons + text
- **Clear error states** - red with clear text, not just color change

### Interactive Elements
- **Large buttons** - min 48px height, plenty of padding
- **Clear labels** - descriptive text, not just icons
- **Loading indicators** - show progress, avoid sudden changes
- **Confirmation dialogs** - for important actions (delete, submit)

### Forms
- **Large input fields** - min 44px height
- **Clear labels** - above inputs, not placeholders only
- **Error messages** - clear, specific, in Bahasa Indonesia
- **One question per screen** - for complex forms, break into steps

### Examples - Bahasa Indonesia Labels
- "Masuk" (Login)
- "Keluar" (Logout)
- "Simpan" (Save)
- "Batal" (Cancel)
- "Hapus" (Delete)
- "Kembali" (Back)
- "Lanjut" (Next/Continue)
- "Cari" (Search)
- "Lihat Detail" (View Details)
- "Ubah" (Edit)

## Implementation Notes
- Use Tailwind for large text utilities: `text-lg`, `text-xl`, `text-2xl`
- Button classes: `px-8 py-4 text-lg` (larger padding and text)
- Color contrast checker: ensure all text passes WCAG AA
- Test with actual elderly users if possible
