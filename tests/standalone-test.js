import { compileModuleTuples, compileToModule, sanityCheck } from './test-common.js';

const src = `

(rule [Rsum x #:sum y]
  [I x y])

(rule [Rmax x #:max y]
  [I x y])
  
(rule [Rmin x #:min y]
  [I x y])
      
(rule [Rcount x #:count y]
  [I x y])
  `;


compileToModule(src, 'standalone', {debug:true, assertions:true}).then(module => {
//import('./compiled/standalone.mjs').then(module => {

module.addTuples(compileModuleTuples(module, `[I 'a 10] [I 'a 20] [I 'b 33]`));
console.log("tuples: " + [...module.tuples()].join('\n'));
console.log("roots: " + [...module.rootTuples()].join('\n'));
// sanityCheck(module); // reachableTuples is not always equal to members

// console.log("\n\n\n");
// module.removeTuples(compileModuleTuples(module, `[Link "a" "b"]`).map(t => t.get())); 
// console.log("tuples: " + [...module.tuples()].join('\n'));
// sanityCheck(module);
})

