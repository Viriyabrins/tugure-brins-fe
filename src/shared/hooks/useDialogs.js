import { useState, useCallback } from "react";

/**
 * Manages multiple dialog open/close states in one place.
 *
 * Usage:
 *   const { dialogs, open, close } = useDialogs(['upload', 'subrogation', 'revision']);
 *   <Dialog open={dialogs.upload} onOpenChange={(v) => v ? open('upload') : close('upload')} />
 *   <Button onClick={() => open('upload')}>Open Upload</Button>
 */
export function useDialogs(names) {
    const keys = Array.isArray(names) ? names : Object.keys(names);
    const [state, setState] = useState(
        Object.fromEntries(keys.map((k) => [k, false])),
    );

    const open = useCallback(
        (name) => setState((prev) => ({ ...prev, [name]: true })),
        [],
    );
    const close = useCallback(
        (name) => setState((prev) => ({ ...prev, [name]: false })),
        [],
    );

    return { dialogs: state, open, close };
}
