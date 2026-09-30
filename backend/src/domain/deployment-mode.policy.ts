export const CAPSTONE_DEMO_NOTICE = 'Capstone demonstration. Not clinically approved. Use test data only.';

export function isCapstoneDemo(source: NodeJS.ProcessEnv = process.env): boolean {
  return source.NUTRIMIND_DEPLOYMENT_MODE === 'capstone-demo';
}
