<script lang="ts">
  /**
   * Renders a cropped icon from its texture atlas.
   * Looks up atlas UV data from modStore.iconAtlasData (vanilla + mod combined),
   * loads the atlas DDS lazily via modStore.loadAtlasImage(), and clips via
   * CSS background-image with pixel-based background-size/position (same formula
   * as TextureAtlasPanel thumbnails).
   */
  import { modStore } from "../lib/stores/modStore.svelte.js";

  let {
    iconName = "",
    size = "md",
  }: {
    /** Icon MapKey name, e.g. "Spell_Wizard_Fireball" */
    iconName?: string;
    /** Display size: "sm" = 20px, "md" = 32px, "lg" = 64px */
    size?: "sm" | "md" | "lg";
  } = $props();

  const sizeMap = { sm: 20, md: 32, lg: 64 } as const;
  let px = $derived(sizeMap[size]);

  /** Atlas metadata for this icon (u1,v1,u2,v2 + dds_path + project_dir). */
  let atlasInfo = $derived(iconName ? modStore.iconAtlasData.get(iconName) : undefined);

  /** Cache key: includes both projectDir and ddsPath to avoid collisions. */
  let cacheKey = $derived(
    atlasInfo ? `${atlasInfo.project_dir}|${atlasInfo.dds_path}` : "",
  );

  /** Trigger lazy atlas image load when we have atlas info. */
  $effect(() => {
    const info = atlasInfo;
    if (info?.dds_path && info?.project_dir) {
      void modStore.loadAtlasImage(info.dds_path, info.project_dir);
    }
  });

  /** Base64 PNG data for the atlas, once loaded. */
  let atlasBase64 = $derived(cacheKey ? modStore.loadedAtlasImages.get(cacheKey) : undefined);

  /**
   * CSS background-image style that crops the icon from the atlas.
   * Pixel-based formula (same as TextureAtlasPanel thumbnails):
   *   background-size:  (thumbPx / iconW)px (thumbPx / iconH)px
   *   background-position: -(u1 * thumbPx / iconW)px -(v1 * thumbPx / iconH)px
   */
  let bgStyle = $derived.by((): string => {
    if (!atlasBase64 || !atlasInfo) return "";
    const { u1, v1, u2, v2 } = atlasInfo;
    const iconW = u2 - u1;
    const iconH = v2 - v1;
    if (iconW <= 0 || iconH <= 0) return "";
    const scaleW = px / iconW;
    const scaleH = px / iconH;
    const posX = -(u1 * scaleW);
    const posY = -(v1 * scaleH);
    return [
      `background-image: url(data:image/png;base64,${atlasBase64})`,
      `background-size: ${scaleW}px ${scaleH}px`,
      `background-position: ${posX}px ${posY}px`,
      "background-repeat: no-repeat",
    ].join("; ");
  });

  let hasPreview = $derived(!!bgStyle);
</script>

<span
  class="icon-atlas-preview icon-atlas-preview-{size}"
  style="width: {px}px; height: {px}px; {bgStyle}"
  aria-hidden="true"
  title={iconName || undefined}
>
  {#if !hasPreview && iconName}
    <!-- Placeholder: first letter of the icon name for visual hint -->
    <span class="icon-atlas-placeholder">{iconName.charAt(0)}</span>
  {/if}
</span>

<style>
  .icon-atlas-preview {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 2px;
    overflow: hidden;
    background-color: var(--th-bg-700, #3f3f46);
    border: 1px solid var(--th-border-600, #52525b);
    vertical-align: middle;
  }

  .icon-atlas-placeholder {
    font-size: 8px;
    color: var(--th-text-500, #71717a);
    font-weight: 600;
    text-transform: uppercase;
    line-height: 1;
    user-select: none;
  }
</style>
