import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import FoodGuidanceSections from './FoodGuidanceSections';
it('shows saved food reasons, preparation tips, empty states and source links',()=>{
 render(<FoodGuidanceSections guidance={{formatVersion:1,avoid:[{name:'Shrimp paste',reason:'Reported shellfish allergy.',tip:'Check labels and shared utensils.',sourceCode:'FDA'}],limit:[],choose:[],discuss:[{name:'Kidney limits',reason:'Not established.',tip:'Ask your RND.',sourceCode:'FDA'}],sources:[{code:'FDA',title:'Food labels',url:'https://www.fda.gov.ph/'}]}}/>);
 for(const name of ['Avoid','Limit','Choose more often','Discuss with your RND'])expect(screen.getByRole('heading',{name})).toBeInTheDocument();
 expect(screen.getByText('Check labels and shared utensils.')).toBeInTheDocument();expect(screen.getByText('Not established.')).toBeInTheDocument();expect(screen.getByRole('link',{name:'Food labels'})).toHaveAttribute('href','https://www.fda.gov.ph/');
});
