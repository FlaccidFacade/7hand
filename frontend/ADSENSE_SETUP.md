# Google AdSense Integration Guide

This guide explains how to set up and configure Google AdSense for revenue generation in your application.

## Features

✅ **Cookie Consent Integration** - Ads only display when users consent to advertising cookies
✅ **Responsive Ad Placement** - Automatic sizing for different screen sizes
✅ **Test Mode** - Safe testing without affecting AdSense account
✅ **Service-based Configuration** - Centralized ad management
✅ **SSR Compatible** - Works with server-side rendering

## Setup Instructions

### 1. Get Your AdSense Account

1. Sign up for [Google AdSense](https://www.google.com/adsense/)
2. Add your website to AdSense
3. Get your **Publisher ID** (format: `ca-pub-XXXXXXXXXXXXXXXX`)
4. Create ad units and get **Ad Slot IDs**

### 2. Configure AdSense Service

Update `/workspace/src/app/services/adsense.service.ts`:

```typescript
private config: AdSenseConfig = {
  adClient: 'ca-pub-YOUR-ACTUAL-ID-HERE',  // Replace with your Publisher ID
  enabled: true,
  testMode: false  // Set to false in production
};

private adSlots = {
  sidebarLeft: 'YOUR-LEFT-AD-SLOT-ID',     // Replace with your ad slot
  sidebarRight: 'YOUR-RIGHT-AD-SLOT-ID',   // Replace with your ad slot
  banner: 'YOUR-BANNER-AD-SLOT-ID',        // Replace with your ad slot
  inContent: 'YOUR-CONTENT-AD-SLOT-ID'     // Replace with your ad slot
};
```

### 3. Add AdSense Script to index.html (Optional)

While the component loads scripts dynamically, you can also add it to `index.html`:

```html
<head>
  <!-- Other head content -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
     crossorigin="anonymous"></script>
</head>
```

## Component Usage

### Basic Usage

```html
<app-google-adsense
  [adClient]="'ca-pub-XXXXXXXXXXXXXXXX'"
  [adSlot]="'1234567890'"
  adFormat="auto">
</app-google-adsense>
```

### With Service

```html
<!-- Desktop Sidebar Ad -->
<app-google-adsense
  [adClient]="adsenseService.getConfig().adClient"
  [adSlot]="adsenseService.getAdSlot('sidebarLeft')"
  adFormat="vertical"
  [adTest]="adsenseService.isTestMode() ? 'on' : 'off'">
</app-google-adsense>
```

### Mobile Popup Ad

The mobile popup ad component is automatically included in the app and requires no additional configuration:

```html
<!-- Add to your app.html -->
<mobile-popup-ad></mobile-popup-ad>
```

**Features:**
- Automatically shows only on mobile/tablet (<1024px)
- 5-second delay before appearing
- Once per session (won't annoy users)
- Respects cookie consent
- Configurable through AdsenseService

## Component Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `adClient` | string | 'ca-pub-XXXXXXXXXXXXXXXX' | Your AdSense publisher ID |
| `adSlot` | string | '' | Ad unit slot ID from AdSense |
| `adFormat` | string | 'auto' | Ad format: 'auto', 'rectangle', 'vertical', 'horizontal' |
| `fullWidthResponsive` | boolean | true | Enable responsive sizing |
| `adTest` | string | 'off' | Set to 'on' for testing, 'off' for production |

## Ad Formats

- **auto**: Automatically adjusts to container size (recommended)
- **vertical**: Tall vertical ads (ideal for sidebars)
- **horizontal**: Wide horizontal ads (ideal for banners)
- **rectangle**: Square or rectangular ads

## Current Implementation

The app currently has:
- **Left Sidebar Ad**: Vertical ad unit on the left side (visible on screens ≥1440px)
- **Right Sidebar Ad**: Vertical ad unit on the right side (visible on screens ≥1440px)
- **Mobile Popup Ad**: Pop-up advertisement with close button (visible on screens <1024px)

### Desktop Ads (Sidebars)
Both sidebar ads:
- Only show when users consent to advertising cookies
- Sticky positioning for better visibility
- Automatically disabled on mobile/tablet devices
- Test mode enabled by default (change in production)

### Mobile Popup Ad
The mobile popup ad:
- ✅ Only appears on mobile/tablet screens (<1024px)
- ✅ Shows after 5-second delay (non-intrusive)
- ✅ Only displays once per session
- ✅ Requires advertising cookie consent
- ✅ Has prominent X-close button
- ✅ Can be closed by clicking backdrop
- ✅ Beautiful slide-up animation
- ✅ Responsive to orientation changes

## Testing

### Test Mode

When `testMode: true` in the service, ads will show with `data-ad-test="on"`, which prevents invalid traffic to your AdSense account.

### Cookie Consent Testing

1. Clear localStorage: `localStorage.clear()`
2. Reload the page
3. Accept advertising cookies in the cookie consent banner
4. Ads should now load

## Privacy & Compliance

✅ **GDPR Compliant** - Cookie consent banner implemented
✅ **Privacy Policy** - Includes AdSense disclosure
✅ **Opt-out Options** - Users can reject advertising cookies
✅ **Transparent** - Clear disclosure of data collection

## Revenue Optimization Tips

1. **Ad Placement**: Ads are placed in high-visibility areas (sidebars)
2. **Responsive Design**: Ads automatically adjust to screen size
3. **User Experience**: Ads don't show on mobile to maintain performance
4. **Consent-based**: Only show ads to consenting users for better engagement
5. **Test First**: Always test in test mode before going live

## Troubleshooting

### Ads Not Showing

1. Check cookie consent is granted for advertising
2. Verify AdSense account is approved
3. Ensure ad slots are correctly configured
4. Check browser console for errors
5. Verify test mode is enabled during development

### Console Warnings

- **"adsbygoogle.push() error"**: Normal during initial setup, will resolve when AdSense approves your site
- **"No slot size for availableWidth"**: Ad unit is still loading, usually resolves automatically

## Going to Production

Before deploying to production:

1. ✅ Replace placeholder IDs with real AdSense IDs
2. ✅ Set `testMode: false` in adsense.service.ts
3. ✅ Verify privacy policy is complete
4. ✅ Test cookie consent flow
5. ✅ Submit site for AdSense review
6. ✅ Wait for AdSense approval
7. ✅ Monitor AdSense dashboard for earnings

## Support

For AdSense-specific issues, visit:
- [AdSense Help Center](https://support.google.com/adsense)
- [AdSense Community](https://support.google.com/adsense/community)

For technical implementation issues, check:
- Component files in `/workspace/src/app/components/google-adsense/`
- Service file in `/workspace/src/app/services/adsense.service.ts`
