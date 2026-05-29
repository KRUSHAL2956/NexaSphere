import os

def replace_in_file(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    orig = content
    for old, new in replacements:
        content = content.replace(old, new)
        
    if 'apiClient' not in content and content != orig:
        lines = content.split('\n')
        # calculate relative path
        parts = filepath.replace('\\', '/').split('/src/')
        if len(parts) > 1:
            depth = len(parts[1].split('/')) - 1
            rel_prefix = '../' * depth if depth > 0 else './'
            import_stmt = f"import apiClient from '{rel_prefix}utils/apiClient.js';"
            for i, line in enumerate(lines):
                if line.startswith('import'):
                    lines.insert(i, import_stmt)
                    break
            else:
                lines.insert(0, import_stmt)
            content = '\n'.join(lines)

    if content != orig:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")


basedir = "c:/anshika/college/gssoc'26/NexaSphere/src"

replace_in_file(os.path.join(basedir, 'hooks/useDataHooks.js'), [
    ("fetch(url)\n      .then(res => {\n        if (!res.ok) throw new Error('Network response was not ok');\n        return res.json();\n      })", "apiClient(url)")
])

replace_in_file(os.path.join(basedir, 'pages/activities/ActivityDetailPage.jsx'), [
    ("const res = await fetch(url);\n    const data = await res.json().catch(() => ({}));\n    if (res.ok && Array.isArray(data?.events)) setManualEvents(data.events);", "const data = await apiClient(url).catch(() => ({}));\n    if (Array.isArray(data?.events)) setManualEvents(data.events);"),
    ("const res = await fetch(url, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ ...auth, eventName, eventDate, eventTagline, eventDescription }),\n      });\n      const data = await res.json().catch(() => ({}));\n      if (!res.ok) throw new Error(data?.error || 'Failed to add event');", "const data = await apiClient(url, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ ...auth, eventName, eventDate, eventTagline, eventDescription }),\n      });"),
    ("const res = await fetch(url, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ ...auth, eventId }),\n      });\n      const data = await res.json().catch(() => ({}));\n      if (!res.ok) throw new Error(data?.error || 'Failed to remove event');", "const data = await apiClient(url, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ ...auth, eventId }),\n      });")
])

replace_in_file(os.path.join(basedir, 'pages/admin/AdminPage.jsx'), [
    ("fetch(`${base}/api/admin/analytics/stats`, { headers })\n        .then(r => r.json()),", "apiClient(`${base}/api/admin/analytics/stats`, { headers }),"),
    ("fetch(`${base}/api/admin/analytics/growth`, { headers })\n        .then(r => r.json()),", "apiClient(`${base}/api/admin/analytics/growth`, { headers }),"),
    ("fetch(`${base}/api/admin/analytics/events`, { headers })\n        .then(r => r.json())", "apiClient(`${base}/api/admin/analytics/events`, { headers })"),
    ("const res = await fetch(`${base}/api/admin/login`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ username, password })\n      });\n\n      const data = await res.json();\n      if (!res.ok) throw new Error(data.error || 'Login failed');", "const data = await apiClient(`${base}/api/admin/login`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ username, password })\n      });")
])

replace_in_file(os.path.join(basedir, 'pages/dashboard/DashboardPage.jsx'), [
    ("const res = await fetch(`${base}/recommend/events/${currentUser.id}`);\n      if (res.ok) {\n        const data = await res.json();\n        setRecommendations(data.recommended_events || []);\n      }", "const data = await apiClient(`${base}/recommend/events/${currentUser.id}`);\n      setRecommendations(data.recommended_events || []);")
])

replace_in_file(os.path.join(basedir, 'pages/membership/MembershipPage.jsx'), [
    ("const res = await fetch(MEMBERSHIP_SCRIPT_URL, {\n        method: 'POST',\n        body: fd,\n        mode: 'no-cors'\n      });\n      // With no-cors, res.ok is false usually, just assume success if no throw\n      if (res.ok || res.status === 0 || res.type === 'opaque') {", "await apiClient(MEMBERSHIP_SCRIPT_URL, {\n        method: 'POST',\n        body: fd,\n        mode: 'no-cors'\n      });\n      if (true) {")
])

replace_in_file(os.path.join(basedir, 'pages/recruitment/RecruitmentPage.jsx'), [
    ("const res = await fetch(RECRUITMENT_SCRIPT_URL, {\n        method: 'POST',\n        body: fd,\n        mode: 'no-cors'\n      });\n      // With no-cors, res.ok is false usually, just assume success if no throw\n      if (res.ok || res.status === 0 || res.type === 'opaque') {", "await apiClient(RECRUITMENT_SCRIPT_URL, {\n        method: 'POST',\n        body: fd,\n        mode: 'no-cors'\n      });\n      if (true) {")
])

replace_in_file(os.path.join(basedir, 'pages/team/TeamSection.jsx'), [
    ("fetch(url)\n      .then(res => {\n        if (!res.ok) throw new Error('Failed to fetch');\n        return res.json();\n      })", "apiClient(url)")
])

replace_in_file(os.path.join(basedir, 'pages/team/TeamSection.tsx'), [
    ("fetch(url)\n      .then(res => {\n        if (!res.ok) throw new Error('Failed to fetch');\n        return res.json();\n      })", "apiClient(url)")
])

replace_in_file(os.path.join(basedir, 'shared/Chatbot.jsx'), [
    ("const response = await fetch('http://localhost:8000/ai/chat', {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n        },\n        body: JSON.stringify({ message: prompt, history: messages.map(m => ({ role: m.role, content: m.text })) }),\n      });\n\n      if (!response.ok) {\n        throw new Error('Network response was not ok');\n      }\n\n      const data = await response.json();", "const data = await apiClient('http://localhost:8000/ai/chat', {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n        },\n        body: JSON.stringify({ message: prompt, history: messages.map(m => ({ role: m.role, content: m.text })) }),\n      });")
])

replace_in_file(os.path.join(basedir, 'utils/pushNotificationClient.js'), [
    ("await fetch('/api/notifications/subscribe', {\n      method: 'POST',\n      headers: {\n        'Content-Type': 'application/json',\n      },\n      body: JSON.stringify(subscription),\n    });", "await apiClient('/api/notifications/subscribe', {\n      method: 'POST',\n      headers: {\n        'Content-Type': 'application/json',\n      },\n      body: JSON.stringify(subscription),\n    });"),
    ("await fetch('/api/notifications/unsubscribe', {\n      method: 'POST',\n      headers: {\n        'Content-Type': 'application/json',\n      },\n      body: JSON.stringify({ endpoint: subscription.endpoint }),\n    });", "await apiClient('/api/notifications/unsubscribe', {\n      method: 'POST',\n      headers: {\n        'Content-Type': 'application/json',\n      },\n      body: JSON.stringify({ endpoint: subscription.endpoint }),\n    });")
])

print("Finished fixing fetches")
