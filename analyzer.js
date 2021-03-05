import { assertTrue, MutableSets, MutableMaps } from 'common';
import { Atom, Neg } from './rsp.js';

function topoSort(predicates)
{

  const sccs = [];

  let index = 0;
  const S = [];

  for (const v of predicates)
  {
    if (v.index === undefined)
    {
      strongconnect(v);
    }
  } 

  function strongconnect(v)
  {
    v.index = index;
    v.lowlink = index;
    index++;
    S.push(v);
    v.onStack = true;

    for (const w of v.precedes)
    {
      if (w.index === undefined)
      {
        strongconnect(w);
        v.lowlink = Math.min(v.lowlink, w.lowlink);
      }
      else if (w.onStack)
      {
        v.lowlink = Math.min(v.lowlink, w.index);
      }
    }
    
    if (v.lowlink === v.index)
    {
      const scc = [];
      let w;
      do
      {
        w = S.pop();
        w.onStack = false;
        scc.push(w);
      }
      while (w !== v)
      sccs.push(scc);
    }
  }
  const rsccs = sccs.reverse();
  return rsccs;
}
 
class Pred
{
  constructor(name, arity)
  {
    this.name = name;
    this.arity = arity;
    this.edb = true;
    this.idb = false;
    this.rules = new Set();
    this.posDependsOn = new Set();
    this.negDependsOn = new Set();
    this.precedes = new Set();
    this.negated = false;
  }

  toString()
  {
    return this.name;
  }
}

function collect(program)
{

  const name2pred = new Map();

  function handleAtom(atom)
  {
    const name = atom.pred;
    const arity = atom.arity();
    let pred = name2pred.get(name);
    if (pred === undefined)
    {
      pred = new Pred(name, arity);
      name2pred.set(name, pred);
      return pred;
    }
    if (pred.arity !== arity)
    {
      throw new Error("arity mismatch: " + pred);
    }
    return pred;
  }

  for (const rule of program.rules)
  {
    const head = rule.head;
    const headPred = handleAtom(head);
    headPred.idb = true;
    headPred.edb = false;
    headPred.rules.add(rule);
    for (const term of rule.body)
    {
      if (term instanceof Atom)
      {
        const pred = handleAtom(term);
        pred.precedes.add(headPred);
        headPred.posDependsOn.add(pred);
      }
      else if (term instanceof Neg)
      {
        const atom = term.atom;
        const pred = handleAtom(atom);
        pred.precedes.add(headPred);
        headPred.negDependsOn.add(pred);
        pred.negated = true;
      }
    }
  }

  return { name2pred };
}

class Stratum
{
  constructor(id, preds)
  {
    this.id = id;
    this.preds = preds;
    this.nonRecursiveRules = new Set();    
    this.recursiveRules = new Set();

    // pred -> [{rule, atompos}]
    this.pred2negDeps = new Map();

    this.posDependsOn = new Set(); // derived from this.preds
    this.negDependsOn = new Set(); // derived from this.preds
  }
  isStratumPredName(predName)
  {
    for (const pred of this.preds)
    {
      if (pred.name === predName)
      {
        return true;
      }
    }
    return false;
  }
  toString()
  {
    return `{stratum id:${this.id} preds:${this.preds.join(",")}}`;
  }
}


function makeStratum(name2pred)
{

  function isStratumRecursiveRule(rule, scPreds)
  {
    for (const atom of rule.body)
    {
      if (atom instanceof Atom) // only pos deps can result in recursive rule
      {
        const bodyPred = name2pred.get(atom.pred);
        if (scPreds.includes(bodyPred))
        {
          return true;
        }  
      }
    }
    return false;
  }

  return function (scPreds, id)
  {
    const stratum = new Stratum(id, scPreds);
    for (const pred of scPreds)
    {
      pred.stratum = stratum;
      MutableSets.addAll(stratum.posDependsOn, pred.posDependsOn);
      MutableSets.addAll(stratum.negDependsOn, pred.negDependsOn);
      for (const rule of pred.rules)
      {
        if (isStratumRecursiveRule(rule, scPreds))
        {
          stratum.recursiveRules.add(rule);
        }
        else
        {
          stratum.nonRecursiveRules.add(rule);
        }

        for (let i = 0; i < rule.body.length; i++)
        {
          const b = rule.body[i];
          if (b instanceof Neg)
          {
            MutableMaps.putPushArray(stratum.pred2negDeps, b.atom.pred, {rule, i});
          }
        }
      }
    }
    return stratum;
  }
}

export function analyzeProgram(program)
{
  const { name2pred } = collect(program);
  const predicates = [...name2pred.values()];
  const sccPreds = topoSort(predicates);
  const strata = sccPreds.map(makeStratum(name2pred));

  const preds = sccPreds.flat();

  return { 
    program, name2pred, strata,
    preds
  };
}