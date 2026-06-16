import { Octokit } from "@octokit/rest";
import type { ExtractedFile } from "./zip";

export function octokitFor(token: string): Octokit {
  return new Octokit({ auth: token });
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  visibility: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  updatedAt: string | null;
}

function mapRepo(r: {
  id: number;
  name: string;
  full_name: string;
  visibility?: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  updated_at: string | null;
}): GitHubRepo {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    visibility: r.visibility ?? (r.private ? "private" : "public"),
    private: r.private,
    defaultBranch: r.default_branch,
    htmlUrl: r.html_url,
    updatedAt: r.updated_at,
  };
}

/** Fetch the authenticated user's repositories (most recently updated first). */
export async function listRepositories(token: string): Promise<GitHubRepo[]> {
  const octokit = octokitFor(token);
  const repos = await octokit.paginate(
    octokit.rest.repos.listForAuthenticatedUser,
    { per_page: 100, sort: "updated", affiliation: "owner" }
  );
  return repos.map(mapRepo);
}

export async function getAuthenticatedUser(token: string) {
  const octokit = octokitFor(token);
  const { data } = await octokit.rest.users.getAuthenticated();
  return data;
}

export interface CreateRepoInput {
  name: string;
  description?: string;
  private: boolean;
}

export async function createRepository(
  token: string,
  input: CreateRepoInput
): Promise<GitHubRepo> {
  const octokit = octokitFor(token);
  const { data } = await octokit.rest.repos.createForAuthenticatedUser({
    name: input.name,
    description: input.description,
    private: input.private,
    auto_init: false,
  });
  return mapRepo(data);
}

export async function deleteRepository(
  token: string,
  owner: string,
  repo: string
): Promise<void> {
  const octokit = octokitFor(token);
  await octokit.rest.repos.delete({ owner, repo });
}

export type ProgressFn = (message: string) => void | Promise<void>;

export interface PublishInput {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  commitMessage: string;
  files: ExtractedFile[];
}

export interface PublishResult {
  commitHash: string;
  commitUrl: string;
  branch: string;
}

/**
 * Publishes files to a GitHub repository using the Git Data API.
 *
 * Works for both empty repositories (initial commit) and existing branches
 * (adds a new commit on top of the current tip). The whole tree is uploaded
 * as blobs, assembled into a tree, and committed in a single push.
 */
export async function publishToRepository(
  input: PublishInput,
  onProgress: ProgressFn = () => {}
): Promise<PublishResult> {
  const { token, owner, repo, branch, commitMessage, files } = input;
  const octokit = octokitFor(token);

  await onProgress(`Uploading ${files.length} files as blobs…`);

  // 1. Create a blob for every file. GitHub accepts base64-encoded content,
  //    which preserves binary data correctly.
  const treeItems: {
    path: string;
    mode: "100644";
    type: "blob";
    sha: string;
  }[] = [];

  let uploaded = 0;
  for (const file of files) {
    const { data: blob } = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: Buffer.from(file.content).toString("base64"),
      encoding: "base64",
    });
    treeItems.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
    uploaded += 1;
    if (uploaded % 25 === 0 || uploaded === files.length) {
      await onProgress(`Uploaded ${uploaded}/${files.length} files`);
    }
  }

  // 2. Determine the current tip of the branch, if any.
  await onProgress("Resolving branch state…");
  let parentSha: string | undefined;
  try {
    const { data: ref } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    parentSha = ref.object.sha;
  } catch {
    parentSha = undefined; // empty repo or new branch
  }

  // 3. Build the tree. We deliberately omit base_tree so the published
  //    archive becomes the exact contents of the commit.
  await onProgress("Creating git tree…");
  const { data: tree } = await octokit.rest.git.createTree({
    owner,
    repo,
    tree: treeItems,
  });

  // 4. Create the commit.
  await onProgress("Creating commit…");
  const { data: commit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: tree.sha,
    parents: parentSha ? [parentSha] : [],
  });

  // 5. Point the branch at the new commit (create the ref if needed).
  await onProgress("Pushing to GitHub…");
  if (parentSha) {
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: commit.sha,
      force: true,
    });
  } else {
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    });
  }

  return {
    commitHash: commit.sha,
    commitUrl: commit.html_url,
    branch,
  };
}
