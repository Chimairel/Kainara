import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import NutritionRuleWorkspace from './NutritionRuleWorkspace';
const api = vi.hoisted(() => ({get:vi.fn(),post:vi.fn()}));
vi.mock('@/lib/axios',()=>({default:api}));
beforeEach(()=>{vi.clearAllMocks();api.get.mockResolvedValue({data:{data:{sources:[{id:'source',title:'Registered source',canonicalUrl:'https://example.org/source'}],policies:[{id:'policy',condition:'DIABETES',policyVersion:'v1',state:'DRAFT',impactReport:null,approvals:[]}]}}});});
it('lets administrators draft policies without exposing activation controls',async()=>{
  render(<NutritionRuleWorkspace role="admin"/>);
  await screen.findByText('DIABETES');
  expect(screen.queryByRole('button',{name:'Approve version'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Load draft template'}));
  expect((screen.getByRole('textbox',{name:'Policy JSON'}) as HTMLTextAreaElement).value).toContain('evidenceSourceId');
  fireEvent.change(screen.getByRole('textbox',{name:'Policy JSON'}),{target:{value:'{broken'}});
  fireEvent.click(screen.getByRole('button',{name:'Save inactive draft'}));
  await screen.findByRole('alert'); expect(api.post).not.toHaveBeenCalled();
});
it('requires an impact report and rationale before a nutritionist can approve',async()=>{
  render(<NutritionRuleWorkspace role="nutritionist"/>);
  const approve=await screen.findByRole('button',{name:'Approve version'});
  expect(approve).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox',{name:'Review rationale'}),{target:{value:'Reviewed the documented population and caveats.'}});
  await waitFor(()=>expect(approve).toBeDisabled());
  expect(screen.getByRole('button',{name:'Run impact check'})).toBeEnabled();
});
