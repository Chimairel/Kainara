import {expect,it} from 'vitest';
import {replacementResultMessage} from './replacement-result';
it('does not turn a committed rejection into a failed decision when preparation fails',()=>{
 expect(replacementResultMessage({replacementResult:{status:'PREPARATION_FAILED'}})).toContain('Rejection saved. Replacement preparation failed');
 expect(replacementResultMessage({replacementResult:{status:'NO_CANDIDATE'}})).toContain('No replacement candidate');
 expect(replacementResultMessage({replacementResult:{status:'HELD'}})).toContain('automatic replacement is stopped');
});
it('can display compatible older server results without falsely claiming no replacement',()=>{
 expect(replacementResultMessage({replacementPlanId:'pending'})).toContain('ready for review');
 expect(replacementResultMessage(undefined)).toContain('Check the queue');
});
