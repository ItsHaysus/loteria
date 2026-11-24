# Repository workflow

- Before starting any new repository work, switch to `master`, fetch `origin`, and fast-forward local `master` to the latest `origin/master`. Do not overwrite or discard a dirty working tree to do this.
- Create a focused work branch only after local `master` is current.
- Keep commits scoped, run the relevant checks, push the branch, and open pull requests against `master`.
- After successfully creating or updating a requested pull request, switch the local checkout back to `master` and fast-forward it from `origin/master` when possible.
- Do not push directly to `master` or merge a pull request unless the user explicitly requests it.
