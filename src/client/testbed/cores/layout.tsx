/**
 * This testbed's dashboard layout (docs/testbed/dashboard.md §0). The file
 * is the testbed's: the common runtime creates it once and never edits it.
 *
 * To change the layout, follow docs/testbed/ui-design.md (scenes first), then
 * export your own `DashboardLayout` here — e.g. a module under
 * `src/client/testbed/cores/` that draws the shared widgets in another
 * arrangement, or one that wraps `defaultLayout`.
 */
import { defaultLayout } from '../dashboard/default-layout';
import type { DashboardLayout } from '../registry';

export const layout: DashboardLayout = defaultLayout;
