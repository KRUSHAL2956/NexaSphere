import os
import re

src_dir = "c:/anshika/college/gssoc'26/NexaSphere/src"

files_to_update = {
    'AiMentor.jsx': [
        (r"const res = await fetch\(`\$\{base\}/ai/review`, \{[\s\S]*?body: JSON\.stringify\(\{ code, language \}\)\n\s*\}\);\s*if \(!res\.ok\) throw new Error\('AI failed to respond'\);\s*const data = await res\.json\(\);",
         r"const data = await apiClient(`${base}/ai/review`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ code, language })\n      });")
    ],
    'PortfolioBuilder.jsx': [
        (r"const res = await fetch\(url, \{\s*method: 'PUT',\s*headers: \{ 'Content-Type': 'application/json' \},\s*body: JSON\.stringify\(payload\)\s*\}\);\s*const data = await res\.json\(\);\s*if \(!res\.ok\) \{\s*throw new Error\(data\.error \|\| 'Failed to save portfolio\.'\);\s*\}",
         r"const data = await apiClient(url, {\n        method: 'PUT',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify(payload)\n      });")
    ],
    'useDataHooks.js': [
        (r"fetch\(url\)\s*\.then\(res => \{\s*if \(!res\.ok\) throw new Error\('Network response was not ok'\);\s*return res\.json\(\);\s*\}\)",
         r"apiClient(url)")
    ],
    'useNotifications.js': [
        (r"const res = await fetch\(base \+ '/api/notifications'\);\s*if \(!res\.ok\) throw new Error\('Failed to fetch'\);\s*const data = await res\.json\(\);",
         r"const data = await apiClient(base + '/api/notifications');"),
        (r"await fetch\(base \+ '/api/notifications/mark-read', \{ method: 'POST', headers: \{ 'Content-Type': 'application/json' \}, body: JSON\.stringify\(\{ id \}\) \}\);",
         r"await apiClient(base + '/api/notifications/mark-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });"),
        (r"await fetch\(base \+ '/api/notifications/mark-all-read', \{ method: 'POST' \}\);",
         r"await apiClient(base + '/api/notifications/mark-all-read', { method: 'POST' });"),
        (r"await fetch\(base \+ '/api/notifications', \{ method: 'DELETE' \}\);",
         r"await apiClient(base + '/api/notifications', { method: 'DELETE' });")
    ],
    'ActivityDetailPage.jsx': [
        (r"const res = await fetch\(url\);\s*if \(!res\.ok\) throw new Error\('Failed'\);\s*const data = await res\.json\(\);",
         r"const data = await apiClient(url);"),
        (r"const res = await fetch\(url, \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application/json' \},\s*body: JSON\.stringify\(\{ action: 'register' \}\)\s*\}\);\s*if \(!res\.ok\) throw new Error\('Registration failed'\);\s*const data = await res\.json\(\);",
         r"const data = await apiClient(url, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ action: 'register' })\n      });"),
        (r"const res = await fetch\(url, \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application/json' \},\s*body: JSON\.stringify\(\{ action: 'unregister' \}\)\s*\}\);\s*if \(!res\.ok\) throw new Error\('Failed to unregister'\);\s*const data = await res\.json\(\);",
         r"const data = await apiClient(url, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ action: 'unregister' })\n      });")
    ],
    'AdminPage.jsx': [
        (r"fetch\(`\$\{base\}/api/admin/analytics/stats`, \{ headers \}\)\s*\.then\(r => r\.json\(\)\)",
         r"apiClient(`${base}/api/admin/analytics/stats`, { headers })"),
        (r"fetch\(`\$\{base\}/api/admin/analytics/growth`, \{ headers \}\)\s*\.then\(r => r\.json\(\)\)",
         r"apiClient(`${base}/api/admin/analytics/growth`, { headers })"),
        (r"fetch\(`\$\{base\}/api/admin/analytics/events`, \{ headers \}\)\s*\.then\(r => r\.json\(\)\)",
         r"apiClient(`${base}/api/admin/analytics/events`, { headers })"),
        (r"const res = await fetch\(`\$\{base\}/api/admin/login`, \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application/json' \},\s*body: JSON\.stringify\(\{ username, password \}\)\s*\}\);\s*const data = await res\.json\(\);\s*if \(!res\.ok\) throw new Error\(data\.error \|\| 'Login failed'\);",
         r"const data = await apiClient(`${base}/api/admin/login`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ username, password })\n      });")
    ],
    'MembershipPage.jsx': [
        (r"const res = await fetch\(MEMBERSHIP_SCRIPT_URL, \{\s*method: 'POST',\s*body: fd,\s*mode: 'no-cors'\s*\}\);\s*// With no-cors, res\.ok is false usually, just assume success if no throw",
         r"await apiClient(MEMBERSHIP_SCRIPT_URL, {\n        method: 'POST',\n        body: fd,\n        mode: 'no-cors'\n      });\n      // With no-cors, res.ok is false usually, just assume success if no throw")
    ],
    'PublicPortfolio.jsx': [
        (r"const res = await fetch\(url\);\s*if \(!res\.ok\) \{[\s\S]*?\}\s*const data = await res\.json\(\);",
         r"const data = await apiClient(url);")
    ],
    'RecruitmentPage.jsx': [
        (r"const res = await fetch\(RECRUITMENT_SCRIPT_URL, \{\s*method: 'POST',\s*body: fd,\s*mode: 'no-cors'\s*\}\);\s*// With no-cors, res\.ok is false usually, just assume success if no throw",
         r"await apiClient(RECRUITMENT_SCRIPT_URL, {\n        method: 'POST',\n        body: fd,\n        mode: 'no-cors'\n      });\n      // With no-cors, res.ok is false usually, just assume success if no throw")
    ],
    'TeamSection.jsx': [
        (r"fetch\(url\)\s*\.then\(res => \{\s*if \(!res\.ok\) throw new Error\('Failed to fetch'\);\s*return res\.json\(\);\s*\}\)",
         r"apiClient(url)")
    ],
    'TeamSection.tsx': [
        (r"fetch\(url\)\s*\.then\(res => \{\s*if \(!res\.ok\) throw new Error\('Failed to fetch'\);\s*return res\.json\(\);\s*\}\)",
         r"apiClient(url)")
    ],
    'Chatbot.jsx': [
        (r"const response = await fetch\('http://localhost:8000/ai/chat', \{\s*method: 'POST',\s*headers: \{\s*'Content-Type': 'application/json',\s*\},[\s\S]*?\}\);\s*if \(!response\.ok\) \{\s*throw new Error\('Network response was not ok'\);\s*\}\s*const data = await response\.json\(\);",
         r"const data = await apiClient('http://localhost:8000/ai/chat', {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n        },\n        body: JSON.stringify({ message: prompt, history: messages.map(m => ({ role: m.role, content: m.text })) }),\n      });")
    ],
    'pushNotificationClient.js': [
        (r"await fetch\('/api/notifications/subscribe', \{\s*method: 'POST',\s*headers: \{\s*'Content-Type': 'application/json',\s*\},\s*body: JSON\.stringify\(subscription\),\s*\}\);",
         r"await apiClient('/api/notifications/subscribe', {\n      method: 'POST',\n      headers: {\n        'Content-Type': 'application/json',\n      },\n      body: JSON.stringify(subscription),\n    });"),
        (r"await fetch\('/api/notifications/unsubscribe', \{\s*method: 'POST',\s*headers: \{\s*'Content-Type': 'application/json',\s*\},\s*body: JSON\.stringify\(\{ endpoint: subscription\.endpoint \}\),\s*\}\);",
         r"await apiClient('/api/notifications/unsubscribe', {\n      method: 'POST',\n      headers: {\n        'Content-Type': 'application/json',\n      },\n      body: JSON.stringify({ endpoint: subscription.endpoint }),\n    });")
    ]
}

def process_file(filepath):
    filename = os.path.basename(filepath)
    if filename not in files_to_update:
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    has_changes = False

    if 'apiClient' not in content:
        rel_path = os.path.relpath(os.path.join(src_dir, 'utils', 'apiClient.js'), os.path.dirname(filepath))
        rel_path = rel_path.replace('\\', '/')
        if not rel_path.startswith('.'):
            rel_path = './' + rel_path
        
        import_stmt = f"import apiClient from '{rel_path}';\n"
        if content.startswith('import'):
            parts = content.split('\n', 1)
            content = parts[0] + '\n' + import_stmt + parts[1]
        else:
            content = import_stmt + content
        has_changes = True

    for pattern, repl in files_to_update[filename]:
        content, count = re.subn(pattern, repl, content, flags=re.MULTILINE)
        if count > 0:
            has_changes = True

    if has_changes and content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, _, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
            process_file(os.path.join(root, file))

print("Done phase 2")
