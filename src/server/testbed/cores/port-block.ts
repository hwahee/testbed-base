/**
 * This testbed's port block +0 (docs/testbed/ports.md): the default `PORT`.
 * A testbed repository sets its own block here, and keeps `Dockerfile` and
 * `.env.example` in step with it. This file is the testbed's (under `cores/`);
 * the common runtime reads the value and never edits it.
 */
export const PORT_BLOCK = 40000;
