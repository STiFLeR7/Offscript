import {lstatSync,realpathSync,existsSync} from 'node:fs';import {resolve,parse,join,relative,sep} from 'node:path';import {isSafeAssetPath} from './direction.js';
/** Reject links anywhere in the supplied path, including existing ancestors and dangling links. */
export function assertUnlinked(path:string):void{
 const absolute=resolve(path);let cursor=parse(absolute).root;
 for(const part of relative(cursor,absolute).split(sep).filter(Boolean)){
  cursor=join(cursor,part);if(lstatSync(cursor,{throwIfNoEntry:false})?.isSymbolicLink())throw new Error('identity: linked path');
 }
}
export function checkedAssetPath(root:string,asset:string):string{
 if(!isSafeAssetPath(asset))throw new Error('identity: unsafe asset path');const target=resolve(root,asset);const rel=relative(resolve(root),target);
 if(!rel||rel.startsWith('..'+sep)||rel==='..'||parse(rel).root)throw new Error('identity: asset outside root');
 assertUnlinked(root);assertUnlinked(target);
 if(existsSync(root)&&existsSync(target)){const realRoot=realpathSync(root);const realTarget=realpathSync(target);const actual=relative(realRoot,realTarget);if(!actual||actual==='..'||actual.startsWith('..'+sep)||parse(actual).root)throw new Error('identity: asset outside real root');}
 return target;
}

/** Project names predate identity ids; keep safe mixed-case names and forbid path segments. */
export function assertProjectClient(value:unknown):asserts value is string {
 if(!isSafeAssetPath(value)||value.includes('/'))throw new Error('identity: unsafe project path');
}
