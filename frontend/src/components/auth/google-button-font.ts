// The Latin Google Sans face used by the standard English GIS iframe.
// Keep this provider-owned asset aligned with GIS when updating the integration.
export const GOOGLE_BUTTON_FONT_SRC =
  'https://fonts.gstatic.com/s/googlesans/v62/4UaRrENHsxJlGDuGo1OIlJfC6l_24rlCK1Yo_Iq2vgCI.woff2';

let pendingFont: Promise<void> | null = null;

/** Prepare the SDK's own face so its initial control doesn't paint in Arial. */
export function loadGoogleButtonFont(): Promise<void> {
  if (typeof FontFace === 'undefined' || !document.fonts?.add) return Promise.resolve();
  if (pendingFont) return pendingFont;

  const promise = new Promise<void>((resolve, reject) => {
    const face = new FontFace('Google Sans', `url(${GOOGLE_BUTTON_FONT_SRC})`, { weight: '400 500' });
    let settled = false;
    const failed = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error('Google button font could not load.'));
    };
    const timeout = setTimeout(failed, 5000);
    void face.load().then(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      // Register only after downloading. A timed-out face cannot cause a late font swap.
      document.fonts.add(face);
      resolve();
    }, failed);
  });
  pendingFont = promise;
  void promise.catch(() => {
    if (pendingFont === promise) pendingFont = null;
  });
  return promise;
}
