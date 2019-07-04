import { VarName, Term } from './terms';
import { impossible } from './util';
import { Def } from './definitions';

export const compileName = (x: VarName) =>
  keywords.indexOf(x) >= 0 ? `${x}_` : x;

export const compile = (term: Term): string => {
  if (term.tag === 'Var') return compileName(term.name);
  if (term.tag === 'Abs') return `(${compileName(term.name)} => ${compile(term.body)})`;
  if (term.tag === 'App') return `${compile(term.left)}(${compile(term.right)})`;
  if (term.tag === 'Let') return `(${compileName(term.name)} => ${compile(term.body)})(${compile(term.val)})`;
  if (term.tag === 'Con') return compile(term.body);
  if (term.tag === 'Decon') return compile(term.body);
  return impossible('compile');
};

export const compileDef = (def: Def, prefix: (name: string) => string): string => {
  if (def.tag === 'DType')
    return '';
  if (def.tag === 'DLet')
    return `${prefix(compileName(def.name))} = ${compile(def.term)};`;
  return impossible('compileDef');
};
export const compileDefs = (ds: Def[], prefix: (name: string) => string): string =>
  ds.map(d => compileDef(d, prefix)).filter(x => x).join('\n') + '\n';

const keywords = `
do
if
in
for
let
new
try
var
case
else
enum
eval
null
this
true
void
with
await
break
catch
class
const
false
super
throw
while
yield
delete
export
import
public
return
static
switch
typeof
default
extends
finally
package
private
continue
debugger
function
arguments
interface
protected
implements
instanceof
`.trim().split(/\s+/);
