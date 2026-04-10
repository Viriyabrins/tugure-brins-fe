import { useKeycloakAuth } from '@/lib/KeycloakContext';

const normalize = (v) => String(v || '').trim().toLowerCase();

function extractRolesAndAccesses(tokenParsed) {
  const rawAccess = tokenParsed?.access;
  const accesses = rawAccess
    ? (Array.isArray(rawAccess) ? rawAccess : [rawAccess]).map(normalize)
    : [];

  const resourceAccess = tokenParsed?.resource_access;
  const azp = tokenParsed?.azp;
  let roles = [];
  if (resourceAccess && typeof resourceAccess === 'object') {
    if (Array.isArray(resourceAccess['brins-tugure']?.roles)) {
      roles = resourceAccess['brins-tugure'].roles.map(normalize);
    } else if (azp && Array.isArray(resourceAccess[azp]?.roles)) {
      roles = resourceAccess[azp].roles.map(normalize);
    }
  }

  return { accesses, roles };
}

/**
 * Returns an object with isTugureViewer, isBrinsViewer, isViewer.
 *
 * Tugure Viewer: role contains "viewer" + "tugure", OR standard access + any tugure role.
 * Brins Viewer:  role contains "viewer" + "brins",  OR standard access + any brins role.
 * isViewer: either of the above, or generic standard-access / viewer role.
 */
export function useViewerRole() {
  const { tokenParsed } = useKeycloakAuth();
  const { accesses, roles } = extractRolesAndAccesses(tokenParsed);

  const isStandardAccess = accesses.includes('standard access');
  const hasViewerRole = roles.some((r) => r.includes('viewer'));

  const isTugureViewer =
    roles.some((r) => r.includes('viewer') && r.includes('tugure')) ||
    (isStandardAccess && roles.some((r) => r.includes('tugure')));

  const isBrinsViewer =
    roles.some((r) => r.includes('viewer') && r.includes('brins')) ||
    (isStandardAccess && roles.some((r) => r.includes('brins')));

  const isViewer = isTugureViewer || isBrinsViewer || isStandardAccess || hasViewerRole;

  return { isViewer, isTugureViewer, isBrinsViewer };
}

/** Returns true when the user is any kind of viewer (read-only). */
export function useIsViewer() {
  return useViewerRole().isViewer;
}

/** Returns true when the user is a Tugure Viewer (can see Debtor Review & Claim Review). */
export function useIsTugureViewer() {
  return useViewerRole().isTugureViewer;
}

/** Returns true when the user is a Brins Viewer (can see Debtor Submit & Recovery Submit). */
export function useIsBrinsViewer() {
  return useViewerRole().isBrinsViewer;
}

/** Convenience inverse — true when the user has write access (is NOT a viewer). */
export function useHasWriteAccess() {
  return !useViewerRole().isViewer;
}
