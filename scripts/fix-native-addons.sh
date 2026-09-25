#!/usr/bin/env sh
#
# Make native addons loadable when the project sits outside Android's linker
# namespace.
#
# The problem: on Termux/Android, the linker refuses to dlopen a library whose
# path is outside a fixed set of permitted directories. Its own warning lists
# them -- /system/lib64, /data, /mnt/expand and friends, but not /root. This
# checkout lives at /root/ebook-formatter-ui, so every native addon fails:
#
#   WARNING: linker: library ".../lightningcss.android-arm64.node" ... is not
#   accessible for the namespace: [... permitted_paths="...:/data:..." ]
#
# Tailwind v4 needs two of them -- @tailwindcss/oxide (scans source files for
# class names) and lightningcss (transforms the CSS). Without them `next build`
# dies on the first stylesheet it compiles, which is why the failure surfaces as
# an error in app/globals.css even though nothing is wrong with that file.
#
# The fix: keep the real binary under /data and leave a symlink behind in
# node_modules. The linker resolves the symlink before it checks the path, so
# what it sees is permitted. Copying is deliberate -- a symlink pointing the
# other way would still resolve to /root and be refused.
#
# `npm install` restores the real files, so this runs from the postinstall
# script. It is a no-op anywhere the addons already work: off Android, or in a
# checkout that is already under /data.
#
# Override the store location with NATIVE_ADDON_STORE.

set -eu

# The Termux home. Under PRoot, $HOME is the guest's (/root) and is exactly the
# path the linker rejects, so it cannot be used to find this.
TERMUX_ROOT=/data/data/com.termux/files/home
STORE="${NATIVE_ADDON_STORE:-$TERMUX_ROOT/.ebook-formatter-native}"

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

# Not Termux -- the addons load normally, and there is nothing to work around.
if [ ! -d "$TERMUX_ROOT" ]; then
    exit 0
fi

# Already inside the permitted set; no symlink needed.
case "$PROJECT_DIR" in
    /data/data/com.termux/*) exit 0 ;;
esac

link_addon() {
    addon=$1
    # -type f in the find below means a symlink never reaches here, so this is
    # always a real file that needs relocating.
    #
    # The store name comes from the path within node_modules rather than the
    # basename: two packages can ship a file called the same thing, and a
    # collision here would silently point both symlinks at one binary.
    relative=${addon#"$PROJECT_DIR/node_modules/"}
    name=$(printf '%s' "$relative" | tr '/' '_')

    mkdir -p "$STORE"
    cp "$addon" "$STORE/$name"
    rm "$addon"
    ln -s "$STORE/$name" "$addon"

    printf 'native addon relocated under /data: %s\n' "$relative"
}

# Every native addon in the tree, not just Tailwind's two: anything here would
# otherwise fail the same way, and the next dependency to ship one should not
# need this script edited.
find "$PROJECT_DIR/node_modules" -name '*.node' -type f 2>/dev/null | while read -r addon; do
    link_addon "$addon"
done
