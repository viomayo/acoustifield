<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Documentation maintenance

Keep `README.md` and `PLAN.MD` aligned with the real app state whenever the app changes.

- Update `README.md` when implemented features, routes, setup steps, commands, data flow, exports, environment variables, or known limitations change.
- Update `PLAN.MD` when roadmap items are completed, reprioritized, removed, or when new follow-up work becomes necessary.
- Do not document aspirational behavior as implemented. Clearly distinguish current behavior from planned work.
- Keep both files short, practical, and in French unless the project owner asks otherwise.
- Remove outdated references to routes, schemas, sync behavior, or exports when the implementation changes.
- After documentation changes, check that `README.md` and `PLAN.MD` do not contradict each other.
