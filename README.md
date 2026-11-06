# Research Library Paper Importer

Research Library Paper Importer 是一个可配置本地路径的 Zotero 插件。它把新下载的论文正文、补充材料、图片、数据表等文件整理到指定论文目录，再作为 Zotero linked attachment 挂到同一个 Zotero 条目下。文档中的 `D:\Research_Library` 只是示例默认路径，可在插件设置页修改。

当前版本：`0.8.6`

适用 Zotero：`7–10`，当前验证目标为 Zotero `10.0.7`（Windows）；保留 Zotero 7–9 的兼容范围，本次未重新实机测试旧版本。

`0.8.6` 更新：将兼容上限扩展到 `10.0.*`，修复导入窗口和设置页文件选择器的默认目录参数，以及设置页脚本在沙盒中的初始化和按钮绑定；增加覆盖路径字符串、取消选择、设置页加载事件的回归测试。

## 核心原则

- Zotero 管题录、标签、笔记、引用和内置 PDF 批注。
- 指定的 `01_Papers` 目录保存唯一 PDF 和附件实体。
- 插件使用 Zotero linked file，不把 PDF 复制进 `C:\Users\<username>\Zotero\storage`。
- Windows 负责主要导入和命名；Mac 通过 Syncthing 同步 `01_Papers` 后读取同一批文件。
- 新文章、补充材料、修复错误条目尽量都通过插件完成，少在资源管理器里手动改已链接文件名。

## 它会做什么

- 扫描一个 inbox 文件夹：一级子文件夹视为一篇文章，顶层每个 PDF 也可独立导入为一篇文章。
- 大批量预览使用固定长度摘要，避免确认按钮超出屏幕。
- 识别每篇文章的主 PDF 和附件。
- 把新文件移动到 `D:\Research_Library\01_Papers`；内容相同的现有磁盘 PDF 会被直接复用。
- 将主 PDF 作为 linked attachment 导入 Zotero。
- 调用 Zotero 的 PDF metadata recognition。
- 将补充 PDF、图片、数据表、代码、RIS/BibTeX 等挂到同一个 Zotero 条目下。
- 根据 Zotero 元数据统一重命名新导入的本地文件；复用的现有 PDF 保持原路径和文件名。
- 对主 PDF 做 SHA256 去重，避免同一 PDF 重复进入 Zotero；仅存在于磁盘但尚未链接的 PDF 会被复用。
- 同一批导入任务中的重复主 PDF 也会在预览阶段跳过。
- 识别失败时创建 fallback 条目，并打 `needs_review`。
- 导入前写入操作日志；中途失败时尽力回滚本次移动和新建条目。
- 写入 JSON 导入日志，方便回看每次移动和重命名结果。

## 它不会做什么

- 不直接修改 Zotero SQLite 数据库。
- 不自动删除旧文件、重复文件或旧 Zotero 条目。
- 不递归读取文章文件夹里的二级子文件夹。
- 不保证所有中文论文都能自动识别完整元数据。
- 不把 linked PDF 上传到 Zotero 官方文件同步空间。
- 不自动合并 Syncthing 冲突文件。

## 安装与更新

公开版本从 GitHub Releases 下载：

```text
https://github.com/Royychinn/research-library-paper-importer/releases/latest
```

在 Release 页的 `Assets` 中下载 `Research_Library_Paper_Importer.xpi`。不要下载 GitHub 自动生成的 `Source code` ZIP；它不是 Zotero 安装包。本地开发构建的安装包位于源码根目录。

安装步骤：

1. 打开 Zotero。
2. 进入 `Tools -> Add-ons`。
3. 点击齿轮图标。
4. 选择 `Install Add-on From File...`。
5. 选择下载或本地构建的 `.xpi` 文件。
6. 重启 Zotero。

正式 Release 同时提供 `updates.json`；也可以用同一个方法手动重新安装新版 `.xpi`，然后重启 Zotero。

如果 `Tools` 菜单里看不到 `Research Library: ...`，先检查插件是否被禁用；如果插件管理器状态混乱，直接重新安装 `.xpi` 通常最快。

## 插件入口

安装成功后，Zotero 的 `Tools` 菜单会出现：

```text
Research Library: Import New_Papers Inbox
Research Library: Import Article Folder...
Research Library: Import Files as One Article...
Research Library: Attach Files to Selected Item...
Research Library: Attach Folder to Selected Item...
Research Library: Rebuild Article from Existing Files...
Research Library: Rebuild Article from Existing Folder...
Research Library: Rename Selected Item Attachments...
Research Library: Settings...
Research Library: Show Last Import / Undo Info
```

插件也会在 Zotero 设置窗口中注册一个偏好页：

```text
Research Library Importer
```

如果你从 `Tools -> Research Library: Settings...` 打开，它会直接跳到这个设置页。

## 首次设置

打开：

```text
Tools -> Research Library: Settings...
```

Windows 建议设置如下：

```text
New papers inbox:
D:\Research_Library\00_Inbox\New_Papers

Paper destination:
D:\Research_Library\01_Papers

Imported folder:
D:\Research_Library\00_Inbox\Imported

Log folder:
D:\Research_Library\04_Workspace\tools\zotero_paper_importer_plugin\logs

Tag dictionary JSON:
D:\Research_Library\04_Workspace\tools\paper_importer\tag_dictionary.json
```

Mac 默认会使用用户目录下的 `Research_Library`，例如：

```text
New papers inbox:
/Users/<username>/Research_Library/00_Inbox/New_Papers

Paper destination:
/Users/<username>/Research_Library/01_Papers

Imported folder:
/Users/<username>/Research_Library/00_Inbox/Imported

Log folder:
/Users/<username>/Research_Library/04_Workspace/tools/zotero_paper_importer_plugin/logs

Tag dictionary JSON:
/Users/<username>/Research_Library/04_Workspace/tools/paper_importer/tag_dictionary.json
```

Mac 上如果旧设置里残留 `D:\...` 这种 Windows 路径，插件会把关键目录恢复成 Mac 默认路径；你也可以在设置页用 `Browse...` 重新选择 Syncthing 同步后的本地目录。

其他设置：

```text
Title word limit:
默认 14，可按需要改成 20

Move empty imported article folders to Imported:
建议开启
```

每个路径右侧都有 `Browse...` 按钮，可以直接浏览本地目录或文件，不需要逐个手动输入。

## 推荐文件夹结构

推荐：一篇文章一个一级文件夹，文件夹内不要再放二级子文件夹。

```text
D:\Research_Library\00_Inbox\New_Papers\
  Gratitude_Paper_01\
    main.pdf
    Supplementary information.pdf
    Fig1.png
    source_data.xlsx

  MDD_Method_Paper_02\
    paper.pdf
    MOESM1_ESM.pdf
    MOESM2_ESM.pdf
```

插件只读取文章文件夹里的直接文件。下面这种结构里，`Extra` 会被忽略：

```text
D:\Research_Library\00_Inbox\New_Papers\SomePaper\
  main.pdf
  Extra\
    figure.png
```

如果你确实有很多附件，把它们直接放在 `SomePaper` 下面即可：

```text
D:\Research_Library\00_Inbox\New_Papers\SomePaper\
  main.pdf
  figure.png
```

`New_Papers` 根目录下直接放多个 PDF 时，插件会把每个 PDF 独立导入为一篇文章。顶层非 PDF 文件无法判断属于哪篇文章，因此只会在预览中提示；需要与正文一起导入的补充材料仍应放入对应的文章子文件夹。

## 常用工作流

### 1. 批量导入新文章

可以把多个独立正文 PDF 直接放在 `New_Papers` 顶层，也可以把带补充材料的文章分别放入一级子文件夹，然后点击：

```text
Tools -> Research Library: Import New_Papers Inbox
```

插件会先显示预览，包括：

- 准备导入的文章数。
- 跳过的重复 PDF 数。
- 需要人工复核或报错的项目。
- 每篇文章选择的主 PDF 和附件数量。

大量文章时只展示前 5 篇，重复项和错误各展示前 2 项，其余以数量汇总；标题、文件名和路径会在预览中截断，完整处理结果仍写入导入日志。

确认后才会移动文件、重命名和写入 Zotero。

### 2. 单独导入一个文章文件夹

适合临时导入一篇文章：

```text
Tools -> Research Library: Import Article Folder...
```

选择的文件夹会被当成一篇文章，文件夹里的直接文件会一起处理。

### 3. 选择多个文件作为一篇文章

适合正文、补充材料和图片散落在同一处时：

```text
Tools -> Research Library: Import Files as One Article...
```

插件会把你选择的这些文件当成同一篇文章。

如果相同主 PDF 已经链接到 Zotero，这个模式会跳过；如果只是 D 盘已有相同文件，则会复用该文件创建 Zotero 条目。修复旧错误条目时请用 Rebuild 模式。

### 4. 给已有 Zotero 条目补充材料

如果一篇文章已经导入 Zotero，后来又下载了补充材料：

1. 在 Zotero 中选中这篇文章的主条目。
2. 点击：

```text
Tools -> Research Library: Attach Files to Selected Item...
```

或者补充材料在一个文件夹里：

```text
Tools -> Research Library: Attach Folder to Selected Item...
```

插件会把这些补充材料移动到 `01_Papers`，按该 Zotero 条目的元数据重命名，并挂到同一个 Zotero 条目下面。

### 5. 修复正文和补充材料搞反的问题

如果之前把正文和补充材料识别错了，但文件已经在 D 盘，可以用：

```text
Tools -> Research Library: Rebuild Article from Existing Files...
```

或：

```text
Tools -> Research Library: Rebuild Article from Existing Folder...
```

Rebuild 模式会跳过重复检测，重新创建一个新的 Zotero 条目，并把所选文件挂到这个新条目下。它不会自动删除旧错误条目。确认新条目正确后，再手动删除旧条目。

### 6. 重命名已有条目的所有附件

如果你已经用 Zotero 自带模板重命名了正文 PDF，但补充材料、图片或数据表还没有跟着改名，选中一个或多个 Zotero 主条目，然后点击：

```text
Tools -> Research Library: Rename Selected Item Attachments...
```

插件会按同一篇文章的 Zotero 元数据重命名该条目下的所有本地文件附件：

```text
Journal Name_2024_Smith_Title.pdf
Journal Name_2024_Smith_Title_Supplement01.pdf
Journal Name_2024_Smith_Title_Figure01.png
Journal Name_2024_Smith_Title_Data01.xlsx
```

多个 PDF 时，插件会优先把不含 `Supplement`、`ESM`、`MOESM`、`Appendix`、`补充`、`附件` 等标记的 PDF 当作正文；仍然有多个候选时，选择最大的 PDF 作为正文。没有本地路径或文件已丢失的附件会跳过并写入日志。

## 主 PDF 选择规则

插件要求每篇文章至少有一个 PDF 作为主 PDF。

规则：

1. 找出所有 PDF。
2. 根据文件名识别补充材料、图片、数据、代码、参考材料等 sidecar。
3. 如果只剩一个正文候选 PDF，就用它作为主 PDF。
4. 如果仍有多个正文候选 PDF，自动选择文件最大的 PDF 作为主 PDF。
5. 其他文件挂为附件。

如果没有任何 PDF，会报：

```text
No main PDF found.
```

这种情况下不能创建新文章条目。你可以先导入正文 PDF，或者在 Zotero 中选中已有条目后用 Attach 模式添加非 PDF 附件。

## 附件类型识别

附件会按文件名和扩展名分类：

```text
Supplement
Figure
Table
Data
Code
Reference
Attachment
```

常见补充材料命名会被识别为附件，例如：

```text
Supplementary information.pdf
supplementary_material.pdf
supporting_information.pdf
additional_file_1.pdf
online_resource_1.pdf
MOESM1_ESM.pdf
MOESM2_ESM.pdf
ESM.pdf
mmc1.pdf
mmc2.docx
s001.pdf
S1_Table.pdf
S2_Fig.pdf
Data_Sheet_1.pdf
source_data.xlsx
highres_image.png
reference_list.bib
```

中文关键词也会识别：

```text
补充
附件
附录
补充信息
支持信息
图
表
表格
数据
代码
参考文献
参考材料
高清
```

## 命名规则

插件使用“字段之间下划线、字段内部保留空格”的命名：

```text
Journal_Year_FirstAuthor_Title
```

也就是说，只有 `Journal`、`Year`、`FirstAuthor`、`Title` 这几个类别之间用 `_` 分隔；期刊名和题目内部保留空格。

正文 PDF：

```text
Journal Name_Year_FirstAuthor_Title With Spaces.pdf
```

附件：

```text
Journal Name_Year_FirstAuthor_Title With Spaces_Supplement01.pdf
Journal Name_Year_FirstAuthor_Title With Spaces_Figure01.png
Journal Name_Year_FirstAuthor_Title With Spaces_Table01.xlsx
Journal Name_Year_FirstAuthor_Title With Spaces_Data01.xlsx
Journal Name_Year_FirstAuthor_Title With Spaces_Code01.zip
Journal Name_Year_FirstAuthor_Title With Spaces_Reference01.bib
Journal Name_Year_FirstAuthor_Title With Spaces_Attachment01.docx
```

字段来源：

```text
Journal:
publicationTitle -> repository -> conferenceName -> publisher -> UnknownJournal

Year:
从 date 字段提取 4 位年份；没有则 UnknownYear

FirstAuthor:
第一个 creator 的 lastName/name/firstName；没有则 UnknownAuthor

Title:
默认取题目前 14 个词，可在设置页修改 Title word limit
```

清理规则：

- 字段之间固定用 `_`。
- 字段内部保留空格。
- 字段内部已有 `_` 会被清理为空格，避免出现过多下划线。
- Windows 文件名非法字符会变成空格。
- 单个字段最长保留 90 个字符。

示例：

```text
Nature Communications_2024_Smith_Gratitude and social decision-making.pdf
```

如果你也使用 Zotero 自带重命名模板，建议尽量保持一致：

```text
{{ publicationTitle suffix="_" }}{{ year suffix="_" }}{{ creators max="1" suffix="_" }}{{ title truncate="100" }}
```

Zotero 模板不能完全复刻插件规则，例如插件是按词数截断标题，Zotero 模板多按字符截断。日常以插件命名为准。

## 标签规则

插件会保留 Zotero 识别出的已有 tag，并结合本地词典补充简洁 tag。

本地词典路径：

```text
D:\Research_Library\04_Workspace\tools\paper_importer\tag_dictionary.json
```

默认示例：

```text
MDD
PLS
IVFC
gratitude
reciprocity
fMRI
CPM
CCA
HMM
ISC
ISFC
normative
ML
```

插件只保留简洁 tag。含空格的长 tag 默认不会作为最终简洁 tag 保留。

识别失败或 fallback 条目会增加：

```text
needs_review
Chinese
thesis
```

其中 `Chinese` 和 `thesis` 只在文件名特征符合时添加。

## 去重规则

插件对主 PDF 做 SHA256 去重。

如果主 PDF 与 Zotero 已链接文件完全相同，会在预览中显示：

```text
duplicate skipped
```

这种情况下不会重复创建 Zotero 条目，也不会删除原文件。

如果完全相同的 PDF 只存在于 `01_Papers` 磁盘目录、但尚未链接到 Zotero，插件会直接复用该现有文件创建条目。它不会移动、重命名或删除 inbox 中的副本。

注意：去重针对“文件内容完全相同”的 PDF。不同版本、下载页码不同、出版社附带封面不同，可能不会被视为同一个文件。

## 日志与撤销

日志目录：

```text
D:\Research_Library\04_Workspace\tools\zotero_paper_importer_plugin\logs
```

每次运行会生成：

```text
import_YYYYMMDD_HHMMSS.json
latest_import_log.json
```

日志记录：

- 原始路径。
- 最终路径。
- Zotero item key。
- 主 PDF 与附件。
- 是否重命名。
- 是否跳过重复。
- 是否需要人工复核。
- 每一步文件移动和本次创建的 Zotero 条目。
- 失败后的自动回滚结果，以及是否仍需人工恢复。

查看最近一次导入：

```text
Tools -> Research Library: Show Last Import / Undo Info
```

该功能只显示最近一次导入信息，不会自动撤销。如果要撤销，需要手动删除 Zotero 条目，并根据日志手动移动文件。

## 与 Zotero linked file 的关系

插件导入的是 linked file，不是 stored file。

这意味着：

- PDF 实体在 `D:\Research_Library\01_Papers`。
- Zotero 条目只保存“这个条目链接到哪个文件”的记录。
- Zotero 官方 300 MB 文件同步额度不会被这些 linked PDF 占用。
- 删除 Zotero 条目通常不会删除 D 盘 linked PDF 本体，但会删除 Zotero 里的链接记录。
- 手动移动或重命名已链接 PDF，会导致 Zotero 附件断链。

建议 Zotero 设置：

```text
Linked Attachment Base Directory:
D:\Research_Library\01_Papers
```

Mac 上对应设置为 Syncthing 同步后的本地目录，例如：

```text
/Users/<username>/Research_Library/01_Papers
```

## 与 Syncthing / Mac 的关系

推荐同步目录：

```text
D:\Research_Library\01_Papers
```

Windows 上：

```text
D:\Research_Library\01_Papers
```

Mac 上：

```text
/Users/<username>/Research_Library/01_Papers
```

Zotero 负责同步：

- 题录。
- 标签。
- Zotero 笔记。
- Zotero 内置 PDF 阅读器批注。

Syncthing 负责同步：

- PDF 文件本体。
- 补充材料。
- 图片。
- 数据表。
- `_zotero_style_data.json` 这类你手动放进 `01_Papers` 的工具数据文件。

不要同步：

```text
C:\Users\<username>\Zotero
```

不要把 Zotero 数据库目录放进 OneDrive、iCloud、Dropbox 或 Syncthing。

## 日常建议

- 新论文优先放到 `00_Inbox\New_Papers`，用插件导入。
- 已导入的 PDF 不要在资源管理器里手动重命名。
- 已导入的 PDF 不要随意移动到新目录。
- 后补材料用 Attach 模式。
- 修复错误导入用 Rebuild 模式。
- Mac 上阅读时尽量用 Zotero 内置 PDF 阅读器。
- 不要在两台电脑同时编辑同一个外部 PDF 文件。
- Syncthing 同步完成前，不要急着在另一台电脑继续编辑同一文件。

## 常见问题

### Tools 菜单里没有 Research Library

可能原因：

- 插件没有安装成功。
- 插件被禁用。
- Zotero 尚未重启。
- 插件管理器处于 pending 状态。

处理：

1. 完全退出 Zotero。
2. 重新打开 Zotero。
3. 仍不出现时，重新安装 `.xpi`。
4. 再重启 Zotero。

### Add-ons 里看不到插件

插件管理器由 Zotero 管理。这个插件现在已经注册了正式偏好页，但如果 Add-ons 列表缓存异常，可能出现列表显示不完整。

优先判断功能是否可用：

```text
Tools -> Research Library: Settings...
```

如果设置页能打开、Tools 菜单能看到导入项，插件已正常加载。

如果功能也没有，重新安装 `.xpi`。

### 设置页没有出现

重新安装 `0.7.0` 或更高版本，然后重启 Zotero。

### 设置页打开后是空的

`0.7.0` 起设置页同时使用 Zotero preference 绑定和插件脚本回填。正常情况下重新打开设置页会显示当前保存值。

如果仍然为空：

1. 重启 Zotero。
2. 重新安装最新版 `.xpi`。
3. 打开 `Tools -> Research Library: Settings...`。
4. 用 `Browse...` 重新选择目录并点击 `Save`。

插件会保护关键目录，空值不会覆盖 `New papers inbox`、`Paper destination`、`Imported folder` 和 `Log folder`。

### Mac 上报没有 D 盘

`0.7.0` 起，插件会按平台设置默认路径：

```text
Windows:
D:\Research_Library

Mac:
/Users/<username>/Research_Library
```

如果 Mac 旧设置里残留 `D:\...`，关键目录会自动恢复成 Mac 默认路径。你仍然应该在 Mac 的设置页用 `Browse...` 确认：

```text
Paper destination:
/Users/<username>/Research_Library/01_Papers
```

### No main PDF found.

当前导入模式需要至少一个主 PDF。

解决：

- 确认文章文件夹里有正文 PDF。
- 如果只是补充材料，请先在 Zotero 选中已有条目，再用 Attach 模式。

### 选错主 PDF

如果正文和补充材料搞反：

```text
Tools -> Research Library: Rebuild Article from Existing Files...
```

选择正确正文 PDF 和所有附件，重新建一个正确条目。确认后手动删除旧错误条目。

### duplicate skipped

说明主 PDF 的 SHA256 与 Zotero 已链接文件一致。

如果你只是想给已有条目补充材料，用 Attach 模式。

如果你确实要重建这个条目，用 Rebuild 模式。

### 中文论文识别不出来

Zotero 对中文学位论文和中文期刊 PDF 的自动识别不稳定。插件会尝试从文件名解析年份、作者、题名，并创建 fallback 条目。

这类条目会带：

```text
needs_review
```

需要后续人工检查元数据。

### 文件已经移动到 D 盘，但 Zotero 断链

通常是手动改名或移动导致的。

解决方式：

- 如果只是一个条目，手动重新链接附件。
- 如果正文/附件关系也错了，用 Rebuild 模式重建。

## 开发与打包

主要文件：

```text
manifest.json
bootstrap.js
paper-importer.js
chrome/content/settings.xhtml
chrome/content/settings.js
build_xpi.py
README.md
```

打包：

```powershell
python .\build_xpi.py
```

语法检查：

```powershell
node --check .\bootstrap.js
node --check .\paper-importer.js
node --check .\chrome\content\settings.js
```

自动测试：

```powershell
node .\tests\test-paper-importer.js
node .\tests\test-file-picker.js
```

`build_xpi.py` 会先执行语法检查和自动测试，再通过临时文件替换旧 XPI；校验失败时保留上一版安装包。构建成功后还会计算 XPI 的 SHA256，并生成与当前版本对应的 `updates.json`。

`manifest.json` 的 `update_url` 指向本仓库 `main` 分支的 `updates.json`。每次发布必须先更新版本号、重新构建、提交新的 `updates.json`，再用同版本标签创建 GitHub Release，并上传构建出的 XPI。

检查 XPI：

```powershell
python -c "from zipfile import ZipFile; import json; p='Research_Library_Paper_Importer.xpi'; z=ZipFile(p); print(json.loads(z.read('manifest.json').decode('utf-8'))['version']); print('testzip', z.testzip())"
```

## 推荐主流程

日常最稳的使用方式：

```text
1. Windows 下载文章和补充材料
2. 每篇文章放入 New_Papers 下的一个一级文件夹
3. Zotero 中运行 Import New_Papers Inbox
4. 插件移动并重命名文件到 D:\Research_Library\01_Papers
5. Zotero 同步题录、标签、笔记和内置批注
6. Syncthing 同步 01_Papers 到 Mac
7. Mac Zotero 通过 Linked Attachment Base Directory 打开同一批文件
```

这套流程能最大限度避免重复 PDF、Zotero storage 副本、Mac 断链和补充材料散落。
