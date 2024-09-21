import { basename, parse, resolve } from 'node:path'
import { readdirSync, statSync } from 'node:fs'
import { cloneRepo } from './git.ts'
import { replaceReadmePath, replaceRelativePath } from './utils/regex.ts'
import { checkHttpStatus, findMarkdownFiles, renameFile } from './utils/functions.ts'
import { addSources, generateGlobalSidebar, generateIndex, generateRepoSidebar, type RepoSidebar } from './utils/docs.ts'
import { INDEX_PATH, SIDEBAR_PATH } from './index.ts'

export async function generateDoc(repoOwner: string, repoName: string, description: string, branch: string) {
  const projectPath = resolve(__dirname, 'projects', repoName)
  const docsUrl = `https://github.com/${repoOwner}/${repoName}/tree/${branch}/docs`
  const readmeUrl = `https://github.com/${repoOwner}/${repoName}/tree/${branch}/docs/01-readme.md`
  const docsFolderStatus = await checkHttpStatus(docsUrl)
  const readmeFileStatus = await checkHttpStatus(readmeUrl)
  const include: string[] = []

  if (docsFolderStatus !== 404) {
    include.push('docs/*')
  }
  if (docsFolderStatus === 404 || readmeFileStatus === 404) {
    include.push('README.md', '!*/README.md')
  }

  await cloneRepo(`https://github.com/${repoOwner}/${repoName}.git`, projectPath, branch, include)

  findMarkdownFiles(projectPath)
    .forEach((file) => {
      replaceRelativePath(file, `https://github.com/${repoOwner}/${repoName}/tree/${branch}`)

      if (basename(file).toLowerCase() === 'readme.md') {
        replaceReadmePath(file, `https://github.com/${repoOwner}/${repoName}/tree/${branch}`)
      }
    })

  readdirSync(projectPath)
    .filter(file => statSync(resolve(projectPath, file)).isFile() && basename(resolve(projectPath, file)).endsWith('.md'))
    .sort()
    .reduce((acc: RepoSidebar | undefined, cur, idx, arr) => {
      const filename = renameFile(resolve(projectPath, cur))

      if (idx === arr.length - 1) {
        const sourceFile = arr.length > 1 ? resolve(projectPath, 'sources.md') : resolve(projectPath, 'readme.md')
        addSources(`https://github.com/${repoOwner}/${repoName}`, sourceFile)

        generateGlobalSidebar(SIDEBAR_PATH, repoName, generateRepoSidebar(repoName, parse(filename).name, acc))
        return undefined
      }

      return generateRepoSidebar(repoName, parse(filename).name, acc)
    }, undefined)

  generateIndex(INDEX_PATH, repoName, description)
}
