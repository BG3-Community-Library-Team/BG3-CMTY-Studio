<script lang="ts">
  import type { GitFileStatus } from "../../lib/tauri/git.js";
  import GitFileItem from "./GitFileItem.svelte";

  interface Props {
    files: GitFileStatus[];
    staged: boolean;
    modPath: string;
  }
  let { files, staged, modPath }: Props = $props();
</script>

<div class="git-file-list">
  {#each files as file (file.path + (file.staged ? "-staged" : "-unstaged"))}
    <GitFileItem {file} {staged} {modPath} />
  {/each}
</div>

<style>
  .git-file-list {
    display: flex;
    flex-direction: column;
  }
</style>
