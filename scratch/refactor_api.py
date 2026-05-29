import os
import re

src_dir = "c:/anshika/college/gssoc'26/NexaSphere/src"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    has_changes = False

    if 'fetch(' not in content:
        return

    # Skip files that don't need changes or are utility files
    if 'apiClient.js' in filepath or 'errorTracking.js' in filepath:
        return
        
    print(f"Processing {filepath}")

    # Inject import if not exists
    if 'apiClient' not in content:
        # Determine relative path to src/utils/apiClient.js
        rel_path = os.path.relpath(os.path.join(src_dir, 'utils', 'apiClient.js'), os.path.dirname(filepath))
        # normalize path
        rel_path = rel_path.replace('\\', '/')
        if not rel_path.startswith('.'):
            rel_path = './' + rel_path
        
        # Insert import after first import statement or at top
        import_stmt = f"import apiClient from '{rel_path}';\n"
        if content.startswith('import'):
            parts = content.split('\n', 1)
            content = parts[0] + '\n' + import_stmt + parts[1]
        else:
            content = import_stmt + content
        has_changes = True

    # 1. AiMentor.jsx
    if 'AiMentor.jsx' in filepath:
        content = re.sub(
            r"const res = await fetch\(([^,]+), (\{[^}]+\})\);\s*if \(!res\.ok\)[^;]+;\s*const data = await res\.json\(\);",
            r"const data = await apiClient(\1, \2);",
            content, flags=re.MULTILINE
        )
        has_changes = True

    # 2. DashboardPage.jsx
    if 'DashboardPage.jsx' in filepath:
        content = re.sub(
            r"const res = await fetch\(([^)]+)\);\s*if \(res\.ok\) \{\s*const data = await res\.json\(\);",
            r"const data = await apiClient(\1);\n      if (data) {",
            content, flags=re.MULTILINE
        )
        has_changes = True

    # 3. PortfolioBuilder.jsx
    if 'PortfolioBuilder.jsx' in filepath:
        content = re.sub(
            r"const res = await fetch\((url)\);\s*if \(res\.ok\) \{\s*const data = await res\.json\(\);",
            r"const data = await apiClient(\1);\n      if (data) {",
            content, flags=re.MULTILINE
        )
        content = re.sub(
            r"const res = await fetch\(url, (\{[^}]+\})\);\s*const data = await res\.json\(\);\s*if \(!res\.ok\) \{\s*throw new Error[^\}]+\}\s*",
            r"const data = await apiClient(url, \1);\n\n      ",
            content, flags=re.MULTILINE
        )
        content = re.sub(
            r"const res = await fetch\(`(https://api\.github\.com/[^`]+)`\);\s*if \(!res\.ok\) \{[^\}]+\}\s*const data = await res\.json\(\);",
            r"const data = await apiClient(`\1`);",
            content, flags=re.MULTILINE
        )
        has_changes = True

    # 4. App.jsx (already done via tool, but let's be safe)
    if 'App.jsx' in filepath and 'apiClient(url)' not in content:
        content = content.replace("fetch(url)\n      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed')))", "apiClient(url)")
        has_changes = True
        
    # Write changes if modified
    if has_changes and content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")


for root, _, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
            process_file(os.path.join(root, file))

print("Done")
