import assert from 'node:assert/strict';
import test from 'node:test';
import { publishedExtendedNutrients, scaledExtendedNutrients, recordedReviewPlateNutrients } from '../src/domain/review-plate-nutrients.policy';
import { rawRecipeServing } from '../src/services/raw-recipe-serving.service';
import type { RecipeCandidateProjection } from '../src/services/recipe-candidate-provider';

const source = { recipeName: 'Recorded dish', calories: 1000, proteinG: 40, carbsG: 100, fatG: 60,
  ingredients: [{ name: 'Noodles', quantity: 100, unit: 'g' }, { name: 'Salt to taste' }],
  publishedNutrition: { sodiumMg: 2000, sugarG: 0, fiberG: 8, potassiumMg: 500, phosphorusMg: null, saturatedFatG: 10 } };
const plan = { mealName: source.recipeName, calories: 790.25, proteinG: 24.725, carbsG: 116.825, fatG: 30.45,
  baseRecipeSignature: 'saved', sourceRawRecipeCandidate: source,
  ingredients: [{ ingredientName: 'Noodles', quantity: 50, unit: 'g' }, { ingredientName: 'Salt to taste', quantity: null, unit: null }],
  servingComponents: [{ calories: 290.25, proteinG: 4.725, carbsG: 66.825, fatG: .45, quantityG: 225,
    foodItem: { sodium: 3, sugar: .1, fiber: .4, potassium: null, phosphorus: 36, saturatedFat: .05 } }] };

test('source nutrients retain recorded zeros and reject missing, invalid or guessed values', () => {
  const values=publishedExtendedNutrients({ sodiumMg: 100, sugarG: 0, fiberG: '3', potassiumMg: NaN, phosphorusMg: -1 });
  assert.equal(values.sodiumMg,100); assert.equal(values.sugarG,0);
  assert.equal(values.fiberG,null); assert.equal(values.potassiumMg,null); assert.equal(values.phosphorusMg,null);
  assert.equal(scaledExtendedNutrients(values,1.5).sodiumMg,150);
  assert.equal(scaledExtendedNutrients(values,1.5).sugarG,0);
});

test('pending plate reads scale an unchanged recorded base and include rice without modifying macros', () => {
  const before=JSON.stringify(plan), nutrients=recordedReviewPlateNutrients(plan);
  assert.equal(nutrients.sodiumMg,1006.75); assert.equal(nutrients.sugarG,.225); assert.equal(nutrients.fiberG,4.9);
  assert.equal(nutrients.saturatedFatG,5.1125); assert.equal(nutrients.potassiumMg,null); assert.equal(nutrients.phosphorusMg,null);
  assert.equal(nutrients.calories,plan.calories); assert.equal(JSON.stringify(plan),before);
});

test('changed source recipe, portion, macros or ingredient identity cannot inherit published nutrients', () => {
  const cases=[
    {...plan,mealName:'Changed dish'}, {...plan,proteinG:25.725},
    {...plan,ingredients:[{ingredientName:'Different noodles',quantity:50,unit:'g'}]},
    {...plan,ingredients:[...plan.ingredients,{ingredientName:'Extra salt',quantity:1,unit:'g'}]},
    {...plan,ingredients:[{...plan.ingredients[0],quantity:51},plan.ingredients[1]]},
    {...plan,sourceRawRecipeCandidate:{...source,calories:1001}},
  ];
  for(const changed of cases) assert.equal(recordedReviewPlateNutrients(changed).sodiumMg,null);
});

test('library totals require the recorded recipe signature and base serving macros', () => {
  const library={...source,sodiumMg:2000,recipeSignature:'saved'};
  const exact={...plan, calories:1290.25,proteinG:44.725,carbsG:166.825,fatG:60.45,libraryMeal:library};
  assert.equal(recordedReviewPlateNutrients(exact).sodiumMg,2006.75);
  assert.equal(recordedReviewPlateNutrients({...exact,baseRecipeSignature:'changed'}).sodiumMg,null);
  assert.equal(recordedReviewPlateNutrients({...exact,calories:1291.25}).sodiumMg,null);
});

test('raw serving projection preserves source extended totals under calorie and macro portion selection', () => {
  const candidate={id:'source',displayName:'Recorded dish',provenance:'PANLASANG_PINOY',state:'ACTIVE',category:null,
    applicableMealTypes:['LUNCH'],nutrition:{calories:1000,proteinG:40,carbsG:100,fatG:60},
    extendedNutrients:publishedExtendedNutrients(source.publishedNutrition),ingredients:[{name:'Noodles',quantity:100,unit:'g'}],
    riceRole:'STANDALONE',riceRoleReviewStatus:'REVIEWED'} as RecipeCandidateProjection;
  for(const budget of [undefined,{calories:500,proteinG:20,carbsG:50,fatG:30}]) {
    const serving=rawRecipeServing({candidate,mealType:'LUNCH',dailyCalorieTarget:1250,ricePreference:'NO_RICE',macroTarget:budget});
    assert.ok(serving); assert.equal(serving.extendedNutrients.sodiumMg,2000*serving.servingScale);
    assert.equal(serving.extendedNutrients.sugarG,0); assert.equal(serving.extendedNutrients.phosphorusMg,null);
  }
});
