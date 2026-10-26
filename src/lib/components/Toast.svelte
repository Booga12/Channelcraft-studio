<script lang="ts">
  // Shows the editor's messages (ed.notify) as toasts. A new message replaces the one showing.
  import { toast } from 'svelte-sonner';
  import { Toaster } from '$lib/components/ui/sonner';
  import { ed, type Toast } from '$lib/editor.svelte';

  let shown: Toast | null = null;
  $effect(() => {
    const t = ed.toast;
    if (!t || t === shown) return;
    shown = t;
    const action = t.action;
    const opts = { id: 'editor', duration: t.ms ?? (t.kind === 'error' ? 8000 : 2800), closeButton: true, action: action ? { label: action.label, onClick: () => action.run() } : undefined };
    if (t.kind === 'error') toast.error(t.text, opts);
    else toast(t.text, opts);
  });
</script>

<Toaster position="bottom-center" offset={64} visibleToasts={1} />
