import {describe,it,expect} from 'vitest';
import {allowed,canTransition} from '../src/server/service.js';
describe('workflow execution state machine',()=>{
 it('permits pending to running',()=>expect(canTransition('pending','running')).toBe(true));
 it('supports human approval checkpoint',()=>expect(canTransition('running','approval')).toBe(true));
 it('blocks skipping approvals from pending',()=>expect(canTransition('pending','completed')).toBe(false));
 it('makes terminal states immutable',()=>{expect(allowed.completed).toHaveLength(0);expect(allowed.failed).toHaveLength(0)});
});
