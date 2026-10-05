export type DirectionAspect = 'typography'|'palette'|'composition'|'imagery'|'surfaces'|'motion'|'voice';
export interface ReferenceChoice {id:string;assetPath:string;selected:DirectionAspect[];rejected:DirectionAspect[];note:string}
export interface DirectionObservation {referenceId:string;aspect:DirectionAspect;observation:string;interpretation:string;uncertainty:string}
export interface DirectionProposal {schemaVersion:1;id:string;project:string;references:ReferenceChoice[];observations:DirectionObservation[];summary:string;locked:string[]}
export interface Approval {actor:string;at:string;source:'user'}
export interface IdentityAsset {path:string;digest:string;role:'logo-light'|'logo-dark'|'font'|'image'}
export interface IdentityDraft {schemaVersion:1;brandId:string;version:number;directionId:string;subject:string;css:string;voice:string;assets:IdentityAsset[];brandContractJson?:string;imageryManifest?:string}
export interface ApprovedIdentity extends IdentityDraft {approval:Approval;digest:string}
