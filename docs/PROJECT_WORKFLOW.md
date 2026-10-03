# Project workflow

Native project initialization and brief acquisition persist project state. Readiness and approval
conditions determine generation admission. Inspect concrete blockers rather than deleting readiness
or inventing approvals. Projects and supplied brand materials remain local and ignored by Git.

Project branding is resolved from `offscript/projects/<project>/references/` for every supported
track. Token CSS is required for generation; optional brand contracts and brand kits describe identity
and asset inputs. Missing project logos or imagery must not silently introduce a different identity.

Compatibility and migration operators under `offscript/src/project/` assess, plan and execute changes
to existing local project state. They preserve the current generation contract and report readiness
rather than implying automatic approval.

Generation writes deliverable HTML, rendering IR, validation scores and review records into the
project workspace. Review and execution APIs require their typed inputs and integrity checks;
framework transformation is experimental. Consult package exports and tests for precise interfaces.
