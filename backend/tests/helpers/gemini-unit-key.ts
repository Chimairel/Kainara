// Import before services that capture their provider configuration at module load.
// These suites replace the provider SDK with mocks; no real key is required.
process.env.GEMINI_API_KEY = 'synthetic-unit-key-not-valid-for-provider-access';
