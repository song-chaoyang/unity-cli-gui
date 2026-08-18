// ==UserScript==
// @name         Codely Marketplace 技能发布助手
// @namespace    https://codely.tuanjie.cn
// @version      2.0.0
// @description  在 Codely 插件市场页面添加"发布技能"和"我的插件"按钮，支持上传 zip 发布 skill/extension，查看/删除已发布插件，在详情页标题旁预览压缩包内容（支持 Markdown 渲染 + 多语言翻译，国内可用）
// @author       chaoyang
// @match        https://codely.tuanjie.cn/*
// @icon         https://codely.tuanjie.cn/static/dist/favicon.ico
// @require      https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
// @require      https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const API_BASE = 'https://codely.tuanjie.cn';

  // ── Token from cookie ──
  function getToken() {
    const m = document.cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function getUserId() {
    const token = getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return parseInt(payload.sub);
    } catch { return null; }
  }

  function getUsername() {
    const token = getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.username;
    } catch { return null; }
  }

  // ── Categories & Icons ──
  const CATEGORIES = {
    code_dev_env: '代码开发环境',
    unity_game_dev: 'Unity 游戏开发',
    office_collaboration: '办公协作',
    content_asset_generation: '内容资产生成',
    creative_design_art: '创意设计',
  };

  const ICONS = [
    'Terminal', 'AppWindow', 'CircuitBoard', 'Workflow', 'Computer',
    'Banknote', 'Flashlight', 'Camera', 'Blend', 'GitPullRequestCreate',
    'TextCursorInput', 'CaseSensitive', 'Figma', 'LucideServer',
    'LucideKeyboardMusic', 'LucideScanFace', 'Box', 'BookOpen',
    'Bot', 'Brain', 'Bug', 'Cloud', 'Code', 'Command', 'Database',
    'Download', 'FileCode', 'Folder', 'Gamepad2', 'Globe', 'Hammer',
    'Image', 'Key', 'Layers', 'Lightbulb', 'Link', 'Lock', 'Mail',
    'MessageSquare', 'Package', 'Palette', 'Plug', 'Rocket', 'Search',
    'Settings', 'Shield', 'ShoppingCart', 'Star', 'Wrench', 'Zap',
    'Sparkles', 'Film', 'Languages', 'Map',
  ];

  // ── API helpers ──
  async function apiGet(path) {
    const token = getToken();
    if (!token) throw new Error('未检测到登录状态，请先登录 Codely');
    const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async function apiPost(path, body) {
    const token = getToken();
    if (!token) throw new Error('未检测到登录状态，请先登录 Codely');
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async function apiDelete(path) {
    const token = getToken();
    if (!token) throw new Error('未检测到登录状态，请先登录 Codely');
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async function uploadToPresigned(url, blob) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/zip' },
      body: blob,
    });
    if (!res.ok) throw new Error(`上传到对象存储失败: ${res.status}`);
    return true;
  }

  // ── Main publish flow ──
  async function publishSkill(formData) {
    const { file, title, version, description, category, type, skillIcon, isUnitySkill } = formData;

    log('1/4 获取上传地址...');
    const presigned = await apiPost('/api/admin/attachments/presigned-url', {
      filename: file.name, scope: 'skills', size: file.size, type: file.type || 'application/zip',
    });

    log('2/4 上传文件...');
    await uploadToPresigned(presigned.url, file);

    log('3/4 创建附件记录...');
    const attachment = await apiPost('/api/admin/attachments', {
      type: file.type || 'application/zip', source: 'tos', filename: file.name,
      scope: 'skills', size: file.size, key: presigned.object_key,
    });

    log('4/4 发布技能...');
    return apiPost('/api/admin/skills', {
      title, version, skill_icon: skillIcon, category, description, type,
      is_unity_skill: isUnitySkill, editor_compatibility: 'all',
      attachment_id: attachment.id, icon_attachment_id: 0, is_recommended: false,
    });
  }

  // ── Fetch my skills ──
  async function fetchMySkills() {
    const userId = getUserId();
    if (!userId) throw new Error('无法获取用户 ID');
    // Paginate — API caps limit at 100
    const all = [];
    let skip = 0;
    while (true) {
      const page = await apiGet(`/api/admin/skills?limit=100&skip=${skip}`);
      const skills = page.skills || page.items || [];
      all.push(...skills);
      const total = page.total || 0;
      if (all.length >= total || skills.length === 0) break;
      skip += 100;
    }
    return all.filter(s => s.owner_id === userId);
  }

  async function deleteSkill(id) {
    return apiDelete(`/api/admin/skills/${id}`);
  }

  // ── UI helpers ──
  function log(msg) {
    const el = document.getElementById('cmp-log');
    if (el) { el.textContent = msg; }
  }

  function injectStyles() {
    const css = `
      .cmp-nav-btn {
        display: inline-flex; align-items: center; gap: 6px;
        background: #6366f1; color: #fff; border: none; border-radius: 8px;
        padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
        transition: background .15s; white-space: nowrap;
      }
      .cmp-nav-btn:hover { background: #4f46e5; }
      .cmp-nav-btn.green { background: #10b981; }
      .cmp-nav-btn.green:hover { background: #059669; }
      .cmp-nav-btn + .cmp-nav-btn { margin-left: 8px; }
      .cmp-overlay {
        position: fixed; inset: 0; z-index: 100000; background: rgba(0,0,0,.5);
        display: flex; align-items: center; justify-content: center;
      }
      .cmp-modal {
        background: var(--cmp-bg, #fff); color: var(--cmp-fg, #1a1a1a);
        border-radius: 16px; padding: 28px; width: 520px; max-height: 85vh;
        overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.3);
      }
      .cmp-modal.wide { width: 760px; }
      .cmp-modal h2 { margin: 0 0 20px; font-size: 20px; font-weight: 700; }
      .cmp-field { margin-bottom: 14px; }
      .cmp-field label { display: block; margin-bottom: 4px; font-size: 13px; font-weight: 500; }
      .cmp-field input, .cmp-field select, .cmp-field textarea {
        width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1px solid #d1d5db;
        border-radius: 8px; font-size: 14px; background: var(--cmp-input-bg, #fff);
        color: var(--cmp-fg, #1a1a1a);
      }
      .cmp-field textarea { min-height: 80px; resize: vertical; }
      .cmp-file-drop {
        border: 2px dashed #d1d5db; border-radius: 12px; padding: 24px; text-align: center;
        cursor: pointer; transition: border-color .2s; font-size: 14px; color: #6b7280;
      }
      .cmp-file-drop:hover { border-color: #6366f1; }
      .cmp-file-drop.has-file { border-color: #10b981; color: #10b981; }
      .cmp-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
      .cmp-actions button { padding: 8px 18px; border-radius: 8px; font-size: 14px; cursor: pointer; border: none; font-weight: 600; }
      .cmp-cancel { background: #e5e7eb; color: #374151; }
      .cmp-submit { background: #6366f1; color: #fff; }
      .cmp-submit:disabled { opacity: .5; cursor: not-allowed; }
      .cmp-log { margin-top: 12px; padding: 8px 12px; background: #f3f4f6; border-radius: 8px; font-size: 13px; color: #6b7280; min-height: 20px; }
      .cmp-log.error { color: #ef4444; background: #fef2f2; }
      .cmp-log.success { color: #10b981; background: #f0fdf4; }
      .cmp-skill-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .cmp-skill-table th { text-align: left; padding: 8px 10px; border-bottom: 2px solid #e5e7eb; font-weight: 600; font-size: 12px; color: #6b7280; text-transform: uppercase; }
      .cmp-skill-table td { padding: 10px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
      .cmp-skill-table tr:hover td { background: rgba(99,102,241,.05); }
      .cmp-skill-icon { width: 28px; height: 28px; border-radius: 6px; background: #6366f1; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
      .cmp-skill-title { font-weight: 600; }
      .cmp-skill-slug { font-size: 11px; color: #9ca3af; font-family: monospace; }
      .cmp-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
      .cmp-badge.skill { background: #dbeafe; color: #1e40af; }
      .cmp-badge.extension { background: #fef3c7; color: #92400e; }
      .cmp-badge.mcp { background: #d1fae5; color: #065f46; }
      .cmp-del-btn { background: #fee2e2; color: #dc2626; border: none; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; font-weight: 600; }
      .cmp-del-btn:hover { background: #fecaca; }
      .cmp-stat { display: flex; gap: 24px; margin-bottom: 16px; padding: 16px; background: var(--cmp-input-bg, #f9fafb); border-radius: 12px; }
      .cmp-stat-item { text-align: center; }
      .cmp-stat-val { font-size: 22px; font-weight: 700; color: #6366f1; }
      .cmp-stat-label { font-size: 12px; color: #6b7280; margin-top: 2px; }
      .cmp-loading { text-align: center; padding: 40px; color: #6b7280; font-size: 14px; }
      .cmp-preview-modal { width: 900px; }
      .cmp-preview-modal.maximized { width: 96vw; max-width: 96vw; max-height: 96vh; }
      .cmp-preview-modal.maximized .cmp-preview-layout { height: calc(96vh - 140px); }
      .cmp-max-btn { background: transparent; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; font-size: 14px; padding: 4px 10px; color: inherit; }
      .cmp-max-btn:hover { background: #f3f4f6; }
      .cmp-preview-layout { display: flex; gap: 0; height: 520px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
      .cmp-preview-sidebar { width: 240px; border-right: 1px solid #e5e7eb; overflow-y: auto; padding: 6px 0; flex-shrink: 0; }
      .cmp-preview-content { flex: 1; overflow-y: auto; padding: 16px; min-width: 0; }
      .cmp-file-item { padding: 6px 12px; cursor: pointer; font-size: 12px; font-family: monospace; transition: background .1s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .cmp-file-item:hover { background: rgba(99,102,241,.1); }
      .cmp-file-item.active { background: #6366f1; color: #fff; }
      .cmp-preview-text { white-space: pre-wrap; word-wrap: break-word; font-size: 13px; line-height: 1.6; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; margin: 0; }
      .cmp-preview-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: #9ca3af; font-size: 14px; }
      .cmp-preview-img { max-width: 100%; max-height: 480px; border-radius: 8px; display: block; margin: 0 auto; }
      .cmp-preview-binary { text-align: center; padding: 40px; color: #9ca3af; font-size: 14px; }
      .cmp-float-btn { position: fixed; bottom: 24px; right: 24px; z-index: 99999; box-shadow: 0 4px 12px rgba(99,102,241,.4); }
      .cmp-tabs { display: flex; gap: 0; margin-bottom: 0; border-bottom: 1px solid #e5e7eb; }
      .cmp-tab { padding: 6px 16px; cursor: pointer; font-size: 12px; font-weight: 600; border: 1px solid transparent; border-bottom: none; border-radius: 6px 6px 0 0; background: transparent; color: #6b7280; transition: all .15s; }
      .cmp-tab.active { background: #6366f1; color: #fff; }
      .cmp-tab:hover:not(.active) { background: rgba(99,102,241,.1); }
      .cmp-md-body { font-size: 14px; line-height: 1.7; }
      .cmp-md-body h1, .cmp-md-body h2, .cmp-md-body h3 { margin: 16px 0 8px; font-weight: 700; }
      .cmp-md-body h1 { font-size: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
      .cmp-md-body h2 { font-size: 18px; }
      .cmp-md-body h3 { font-size: 16px; }
      .cmp-md-body p { margin: 8px 0; }
      .cmp-md-body ul, .cmp-md-body ol { margin: 8px 0; padding-left: 24px; }
      .cmp-md-body li { margin: 4px 0; }
      .cmp-md-body code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: 'SF Mono','Fira Code','Consolas',monospace; }
      .cmp-md-body pre { background: #1e1e2e; color: #cdd6f4; padding: 12px; border-radius: 8px; overflow-x: auto; margin: 8px 0; }
      .cmp-md-body pre code { background: transparent; padding: 0; color: inherit; }
      .cmp-md-body table { border-collapse: collapse; margin: 8px 0; font-size: 13px; }
      .cmp-md-body th, .cmp-md-body td { border: 1px solid #e5e7eb; padding: 6px 12px; }
      .cmp-md-body th { background: #f9fafb; font-weight: 600; }
      .cmp-md-body blockquote { border-left: 3px solid #6366f1; margin: 8px 0; padding: 4px 16px; color: #6b7280; background: rgba(99,102,241,.05); border-radius: 0 6px 6px 0; }
      .cmp-md-body a { color: #6366f1; text-decoration: underline; }
      .cmp-md-body hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
      .cmp-md-body img { max-width: 100%; border-radius: 8px; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function detectTheme() {
    const dark = document.documentElement.classList.contains('dark');
    if (dark) {
      document.documentElement.style.setProperty('--cmp-bg', '#1e1e2e');
      document.documentElement.style.setProperty('--cmp-fg', '#cdd6f4');
      document.documentElement.style.setProperty('--cmp-input-bg', '#313244');
    }
  }

  // ── Publish Modal ──
  function createPublishModal() {
    detectTheme();
    const overlay = document.createElement('div');
    overlay.className = 'cmp-overlay';
    overlay.id = 'cmp-overlay';
    overlay.innerHTML = `
      <div class="cmp-modal">
        <h2>🚀 发布技能到市场</h2>
        <div class="cmp-field">
          <label>技能标题 *</label>
          <input type="text" id="cmp-title" placeholder="例如: Unity CLI" />
        </div>
        <div class="cmp-field">
          <label>版本号 * (语义化版本 如 1.0.0)</label>
          <input type="text" id="cmp-version" placeholder="1.0.0" value="1.0.0" />
        </div>
        <div class="cmp-field">
          <label>描述</label>
          <textarea id="cmp-desc" placeholder="技能描述..."></textarea>
        </div>
        <div style="display:flex; gap:12px;">
          <div class="cmp-field" style="flex:1;">
            <label>类型</label>
            <select id="cmp-type">
              <option value="skill">skill</option>
              <option value="extension">extension</option>
              <option value="mcp">mcp</option>
            </select>
          </div>
          <div class="cmp-field" style="flex:1;">
            <label>分类</label>
            <select id="cmp-category">
              ${Object.entries(CATEGORIES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:flex; gap:12px;">
          <div class="cmp-field" style="flex:1;">
            <label>图标</label>
            <select id="cmp-icon">
              ${ICONS.map(i => `<option value="${i}">${i}</option>`).join('')}
            </select>
          </div>
          <div class="cmp-field" style="flex:1; display:flex; align-items:flex-end;">
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
              <input type="checkbox" id="cmp-unity" style="width:auto;" /> Unity 原生技能
            </label>
          </div>
        </div>
        <div class="cmp-field">
          <label>Zip 包 *</label>
          <div class="cmp-file-drop" id="cmp-drop">
            点击或拖拽 .zip 文件到此处
            <input type="file" id="cmp-file" accept=".zip,application/zip" style="display:none;" />
          </div>
        </div>
        <div class="cmp-log" id="cmp-log">就绪</div>
        <div class="cmp-actions">
          <button class="cmp-cancel" id="cmp-cancel">取消</button>
          <button class="cmp-submit" id="cmp-submit">发布</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const drop = overlay.querySelector('#cmp-drop');
    const fileInput = overlay.querySelector('#cmp-file');
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = '#6366f1'; });
    drop.addEventListener('dragleave', () => { drop.style.borderColor = ''; });
    drop.addEventListener('drop', e => {
      e.preventDefault();
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0], drop);
    });
    fileInput.addEventListener('change', e => {
      if (e.target.files[0]) handleFile(e.target.files[0], drop);
    });

    overlay.querySelector('#cmp-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#cmp-submit').addEventListener('click', async () => {
      const logEl = overlay.querySelector('#cmp-log');
      const btn = overlay.querySelector('#cmp-submit');
      logEl.className = 'cmp-log';
      logEl.textContent = '开始发布...';
      btn.disabled = true;

      try {
        const file = fileInput.files[0];
        if (!file) throw new Error('请选择 zip 文件');

        const version = overlay.querySelector('#cmp-version').value.trim();
        if (!/^\d+\.\d+\.\d+/.test(version)) throw new Error('版本号需符合 x.y.z 格式');

        const skill = await publishSkill({
          file,
          title: overlay.querySelector('#cmp-title').value.trim(),
          version,
          description: overlay.querySelector('#cmp-desc').value.trim(),
          category: overlay.querySelector('#cmp-category').value,
          type: overlay.querySelector('#cmp-type').value,
          skillIcon: overlay.querySelector('#cmp-icon').value,
          isUnitySkill: overlay.querySelector('#cmp-unity').checked,
        });

        logEl.className = 'cmp-log success';
        logEl.textContent = `✅ 发布成功! ID: ${skill.id}, Slug: ${skill.slug}`;
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        logEl.className = 'cmp-log error';
        logEl.textContent = `❌ ${err.message}`;
        btn.disabled = false;
      }
    });

    return overlay;
  }

  // ── My Skills Modal ──
  function createMySkillsModal() {
    detectTheme();
    const overlay = document.createElement('div');
    overlay.className = 'cmp-overlay';
    overlay.id = 'cmp-overlay';
    overlay.innerHTML = `
      <div class="cmp-modal wide">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="margin:0;">📦 我的插件</h2>
          <button class="cmp-cancel" id="cmp-cancel" style="padding:6px 16px;">✕ 关闭</button>
        </div>
        <div class="cmp-loading" id="cmp-skills-loading">加载中...</div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#cmp-cancel').addEventListener('click', () => overlay.remove());

    // Click outside to close
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    // Fetch and render
    (async () => {
      const loadingEl = overlay.querySelector('#cmp-skills-loading');
      try {
        const skills = await fetchMySkills();
        if (skills.length === 0) {
          loadingEl.innerHTML = '<div style="text-align:center;padding:30px;color:#6b7280;">还没有发布任何插件</div>';
          return;
        }

        const totalDl = skills.reduce((sum, s) => sum + (s.download_count || 0), 0);
        const totalFav = skills.reduce((sum, s) => sum + (s.favorite_count || 0), 0);

        // Build stats
        const statsHtml = `
          <div class="cmp-stat">
            <div class="cmp-stat-item"><div class="cmp-stat-val">${skills.length}</div><div class="cmp-stat-label">已发布</div></div>
            <div class="cmp-stat-item"><div class="cmp-stat-val">${totalDl.toLocaleString()}</div><div class="cmp-stat-label">总下载量</div></div>
            <div class="cmp-stat-item"><div class="cmp-stat-val">${totalFav}</div><div class="cmp-stat-label">总收藏数</div></div>
          </div>
        `;

        // Build table
        const rows = skills.map(s => {
          const icon = s.skill_icon ? s.skill_icon.charAt(0).toUpperCase() : '?';
          const date = new Date(s.updated_at || s.created_at).toLocaleDateString('zh-CN');
          return `
            <tr>
              <td><div class="cmp-skill-icon">${icon}</div></td>
              <td>
                <a class="cmp-skill-title" href="/marketplace/${s.slug}" target="_blank" style="text-decoration:none;color:inherit;cursor:pointer;">${s.title} 🔗</a>
                <div class="cmp-skill-slug">${s.slug}</div>
              </td>
              <td><span class="cmp-badge ${s.type}">${s.type}</span></td>
              <td>v${s.version}</td>
              <td>⬇ ${s.download_count || 0}</td>
              <td>⭐ ${s.favorite_count || 0}</td>
              <td>${date}</td>
              <td><button class="cmp-del-btn" data-id="${s.id}" data-title="${s.title}">删除</button></td>
            </tr>
          `;
        }).join('');

        loadingEl.outerHTML = statsHtml + `
          <table class="cmp-skill-table">
            <thead>
              <tr>
                <th></th><th>标题</th><th>类型</th><th>版本</th><th>下载</th><th>收藏</th><th>更新</th><th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `;

        // Bind delete buttons
        overlay.querySelectorAll('.cmp-del-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const title = btn.dataset.title;
            if (!confirm(`确定删除「${title}」吗？此操作不可撤销。`)) return;

            btn.disabled = true;
            btn.textContent = '删除中...';
            try {
              await deleteSkill(id);
              const row = btn.closest('tr');
              row.style.transition = 'opacity .3s';
              row.style.opacity = '0';
              setTimeout(() => row.remove(), 300);
            } catch (err) {
              alert(`删除失败: ${err.message}`);
              btn.disabled = false;
              btn.textContent = '删除';
            }
          });
        });

      } catch (err) {
        loadingEl.innerHTML = `<div style="color:#ef4444;text-align:center;padding:30px;">❌ ${err.message}</div>`;
      }
    })();

    return overlay;
  }

  function handleFile(file, dropEl) {
    if (!file.name.endsWith('.zip')) {
      alert('请选择 .zip 文件');
      return;
    }
    dropEl.classList.add('has-file');
    dropEl.textContent = `📦 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  }

  function requireAuth() {
    const token = getToken();
    if (!token) {
      alert('未检测到登录状态，请先登录 Codely 后再试');
      return false;
    }
    return true;
  }

  // ── JSZip + marked.js (pre-loaded via @require) ──
  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return Promise.reject(new Error('JSZip 未加载，请确保 Tampermonkey @require 正常工作'));
  }

  function loadMarked() {
    if (window.marked) return Promise.resolve(window.marked);
    return Promise.reject(new Error('marked 未加载，请确保 Tampermonkey @require 正常工作'));
  }

  // ── Translation (multi-provider fallback) ──
  const LANGS = { 'zh-CN': '中文', 'en': 'English', 'ja': '日本語', 'ko': '한국어', 'fr': 'Français', 'de': 'Deutsch', 'es': 'Español', 'ru': 'Русский', 'pt': 'Português', 'it': 'Italiano' };
  const _translateCache = {};

  // Provider 1: Google Translate (works with VPN / outside China)
  async function googleTranslate(seg, targetLang) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(seg)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data[0] || []).map(item => item[0]).join('') || seg;
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  // Provider 2: MyMemory (works in China, free 5000 chars/day)
  async function myMemoryTranslate(seg, targetLang) {
    const sourceLang = 'en'; // Most skills are in English
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(seg)}&langpair=${sourceLang}|${targetLang}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = data?.responseData?.translatedText;
      if (!text || text.includes('MYMEMORY WARNING') || text.includes('PLEASE SELECT')) throw new Error('翻译质量受限');
      return text;
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  async function translateText(text, targetLang) {
    const cacheKey = targetLang + ':' + text.slice(0, 200);
    if (_translateCache[cacheKey]) return _translateCache[cacheKey];

    // Split by code blocks — don't translate code
    const segments = text.split(/(```[\s\S]*?```|`[^`]+`)/);
    const translated = [];
    let googleFailed = false;
    let myMemoryFailed = false;

    for (const seg of segments) {
      if (seg.startsWith('```') || seg.startsWith('`')) {
        translated.push(seg);
      } else if (seg.trim().length === 0) {
        translated.push(seg);
      } else {
        let result = null;
        // Try Google first (unless already known to fail)
        if (!googleFailed) {
          try { result = await googleTranslate(seg, targetLang); }
          catch { googleFailed = true; }
        }
        // Fallback to MyMemory
        if (!result && !myMemoryFailed) {
          try { result = await myMemoryTranslate(seg, targetLang); }
          catch { myMemoryFailed = true; }
        }
        translated.push(result || seg);
      }
    }

    const result = translated.join('');
    _translateCache[cacheKey] = result;

    if (googleFailed && myMemoryFailed) {
      throw new Error('所有翻译服务均不可用。Google 可能被墙，MyMemory 可能达到限额。请稍后重试或使用 VPN。');
    }
    return result;
  }

  // ── Fetch skill zip download URL from public API ──
  async function fetchSkillZipUrl(slug) {
    let skip = 0;
    while (true) {
      const data = await apiGet(`/api/skills?limit=100&skip=${skip}`);
      const items = data.items || data.skills || [];
      const skill = items.find(s => s.slug === slug);
      if (skill) {
        const attMap = data.attachment_map || {};
        const att = attMap[skill.attachmentId];
        if (att && att.url) return { url: att.url, title: skill.title };
      }
      if (items.length < 100) break;
      skip += 100;
    }
    throw new Error('无法找到插件的下载地址');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  const TEXT_EXTS = ['md','txt','js','ts','json','py','sh','cs','yaml','yml','xml','html','css','tsx','jsx','toml','ini','cfg','env','lock'];
  const IMG_EXTS = ['png','jpg','jpeg','gif','svg','webp','ico','bmp'];

  function getFileExt(name) {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  function getFileIcon(name) {
    const ext = getFileExt(name);
    if (ext === 'md') return '📝';
    if (IMG_EXTS.includes(ext)) return '🖼️';
    if (['js','ts','jsx','tsx'].includes(ext)) return '📜';
    if (['json','yaml','yml','toml'].includes(ext)) return '⚙️';
    if (['sh','py','cs'].includes(ext)) return '🔧';
    return '📄';
  }

  // ── Preview Modal (detail page) ──
  function createPreviewModal(slug) {
    detectTheme();
    const overlay = document.createElement('div');
    overlay.className = 'cmp-overlay';
    overlay.id = 'cmp-overlay';
    overlay.innerHTML = `
      <div class="cmp-modal cmp-preview-modal">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="margin:0;" id="cmp-preview-title">👁 预览加载中...</h2>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="cmp-max-btn" id="cmp-max-btn" title="最大化/还原">⛶</button>
            <button class="cmp-cancel" id="cmp-cancel" style="padding:6px 16px;">✕ 关闭</button>
          </div>
        </div>
        <div class="cmp-loading" id="cmp-preview-body">正在下载并解压插件包...</div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#cmp-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    // Maximize/restore toggle
    const modalEl = overlay.querySelector('.cmp-modal');
    const maxBtn = overlay.querySelector('#cmp-max-btn');
    maxBtn.addEventListener('click', () => {
      modalEl.classList.toggle('maximized');
      maxBtn.textContent = modalEl.classList.contains('maximized') ? '🗗' : '⛶';
    });

    (async () => {
      const bodyEl = overlay.querySelector('#cmp-preview-body');
      try {
        const { url: zipUrl, title } = await fetchSkillZipUrl(slug);
        overlay.querySelector('#cmp-preview-title').textContent = `👁 预览: ${title}`;

        const zipResp = await fetch(`${API_BASE}${zipUrl}`);
        if (!zipResp.ok) throw new Error(`下载失败: ${zipResp.status}`);
        const zipBlob = await zipResp.blob();

        const JSZip = await loadJSZip();
        const zip = await JSZip.loadAsync(zipBlob);

        const files = [];
        zip.forEach((path, entry) => { if (!entry.dir) files.push({ path, entry }); });
        files.sort((a, b) => a.path.localeCompare(b.path));

        if (files.length === 0) {
          bodyEl.innerHTML = '<div style="text-align:center;padding:30px;color:#6b7280;">压缩包为空</div>';
          return;
        }

        bodyEl.className = '';
        bodyEl.innerHTML = `
          <div class="cmp-preview-layout">
            <div class="cmp-preview-sidebar">
              ${files.map((f, i) => `
                <div class="cmp-file-item" data-idx="${i}" title="${f.path}">${getFileIcon(f.path)} ${f.path.split('/').pop()}</div>
              `).join('')}
            </div>
            <div class="cmp-preview-content" id="cmp-preview-content">
              <div class="cmp-preview-empty">选择左侧文件查看内容</div>
            </div>
          </div>
        `;

        const contentEl = overlay.querySelector('#cmp-preview-content');
        overlay.querySelectorAll('.cmp-file-item').forEach((item, idx) => {
          item.addEventListener('click', async () => {
            overlay.querySelectorAll('.cmp-file-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');

            const file = files[idx];
            const ext = getFileExt(file.path);
            contentEl.innerHTML = '<div class="cmp-loading">加载中...</div>';

            try {
              if (IMG_EXTS.includes(ext)) {
                const blob = await file.entry.async('blob');
                const url = URL.createObjectURL(blob);
                contentEl.innerHTML = `<img src="${url}" class="cmp-preview-img" />`;
              } else if (ext === 'md') {
                const text = await file.entry.async('text');
                const truncated = text.length > 50000
                  ? text.slice(0, 50000) + '\n\n... (内容已截断，共 ' + text.length + ' 字符)'
                  : text;
                contentEl.innerHTML = `
                  <div class="cmp-tabs">
                    <button class="cmp-tab active" data-mode="render">📄 渲染</button>
                    <button class="cmp-tab" data-mode="source">⌨️ 源码</button>
                    <button class="cmp-tab" data-mode="translate">🌐 翻译</button>
                  </div>
                  <div class="cmp-tab-pane" id="cmp-pane-render" style="padding:4px 0;">
                    <div class="cmp-loading">渲染中...</div>
                  </div>
                  <div class="cmp-tab-pane" id="cmp-pane-source" style="display:none;padding:4px 0;">
                    <pre class="cmp-preview-text">${escapeHtml(truncated)}</pre>
                  </div>
                  <div class="cmp-tab-pane" id="cmp-pane-translate" style="display:none;padding:4px 0;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                      <select id="cmp-translate-lang" style="padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;background:var(--cmp-input-bg,#fff);color:var(--cmp-fg,#1a1a1a);">
                        ${Object.entries(LANGS).map(([code, name]) => `<option value="${code}" ${code === 'zh-CN' ? 'selected' : ''}>${name}</option>`).join('')}
                      </select>
                      <button class="cmp-nav-btn" id="cmp-translate-btn" style="padding:4px 12px;font-size:12px;">翻译</button>
                    </div>
                    <div id="cmp-translate-result" style="min-height:60px;">
                      <div style="color:#9ca3af;padding:12px;">点击"翻译"按钮，将内容翻译为所选语言（代码块不会被翻译）</div>
                    </div>
                  </div>
                `;
                const renderPane = contentEl.querySelector('#cmp-pane-render');
                try {
                  const marked = await loadMarked();
                  renderPane.innerHTML = `<div class="cmp-md-body">${marked.parse(truncated)}</div>`;
                } catch {
                  renderPane.innerHTML = `<div style="color:#ef4444;padding:12px;">Markdown 渲染加载失败，请使用源码查看</div>`;
                }

                // Translation button
                const transBtn = contentEl.querySelector('#cmp-translate-btn');
                const transResult = contentEl.querySelector('#cmp-translate-result');
                const transLangSel = contentEl.querySelector('#cmp-translate-lang');
                transBtn.addEventListener('click', async () => {
                  const lang = transLangSel.value;
                  transBtn.disabled = true;
                  transBtn.textContent = '翻译中...';
                  transResult.innerHTML = '<div class="cmp-loading">正在翻译，请稍候...</div>';
                  try {
                    const translated = await translateText(truncated, lang);
                    const marked = await loadMarked();
                    transResult.innerHTML = `<div class="cmp-md-body">${marked.parse(translated)}</div>`;
                  } catch (err) {
                    transResult.innerHTML = `<div style="color:#ef4444;padding:12px;">❌ 翻译失败: ${err.message}</div>`;
                  }
                  transBtn.disabled = false;
                  transBtn.textContent = '翻译';
                });

                contentEl.querySelectorAll('.cmp-tab').forEach(tab => {
                  tab.addEventListener('click', () => {
                    contentEl.querySelectorAll('.cmp-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const mode = tab.dataset.mode;
                    contentEl.querySelector('#cmp-pane-render').style.display = mode === 'render' ? '' : 'none';
                    contentEl.querySelector('#cmp-pane-source').style.display = mode === 'source' ? '' : 'none';
                    contentEl.querySelector('#cmp-pane-translate').style.display = mode === 'translate' ? '' : 'none';
                  });
                });
              } else if (TEXT_EXTS.includes(ext)) {
                const text = await file.entry.async('text');
                const truncated = text.length > 50000
                  ? text.slice(0, 50000) + '\n\n... (内容已截断，共 ' + text.length + ' 字符)'
                  : text;
                contentEl.innerHTML = `<pre class="cmp-preview-text">${escapeHtml(truncated)}</pre>`;
              } else {
                const size = (file.entry._data?.uncompressedSize || 0) / 1024;
                contentEl.innerHTML = `<div class="cmp-preview-binary">📦 二进制文件<br><br>路径: ${file.path}<br>大小: ${size.toFixed(1)} KB</div>`;
              }
            } catch (err) {
              contentEl.innerHTML = `<div class="cmp-preview-binary">❌ 加载失败: ${err.message}</div>`;
            }
          });
        });

        // Auto-select first .md file, or first file
        const mdIdx = files.findIndex(f => getFileExt(f.path) === 'md');
        const autoIdx = mdIdx >= 0 ? mdIdx : 0;
        const firstItem = overlay.querySelectorAll('.cmp-file-item')[autoIdx];
        if (firstItem) firstItem.click();

      } catch (err) {
        bodyEl.innerHTML = `<div style="color:#ef4444;text-align:center;padding:30px;">❌ ${err.message}</div>`;
      }
    })();
  }

  function addPreviewButton() {
    const match = window.location.pathname.match(/^\/marketplace\/([^/?#]+)/);
    if (!match) return true; // not a detail page
    const slug = match[1];
    if (!slug || slug === 'marketplace') return true;

    if (document.getElementById('cmp-preview-btn')) return true;

    // Find the skill title h1 on the detail page
    const h1s = document.querySelectorAll('h1');
    let titleEl = null;
    for (const h1 of h1s) {
      // Skip nav/header h1s — look for the main content title
      if (h1.offsetParent !== null && h1.textContent.trim().length > 0) {
        titleEl = h1;
        break;
      }
    }
    if (!titleEl) return false;

    const btn = document.createElement('button');
    btn.id = 'cmp-preview-btn';
    btn.className = 'cmp-nav-btn';
    btn.textContent = '👁 预览内容';
    btn.style.marginLeft = '12px';
    btn.style.verticalAlign = 'middle';
    btn.addEventListener('click', () => { if (requireAuth()) createPreviewModal(slug); });
    titleEl.appendChild(btn);
    return true;
  }

  function addNavButtons() {
    if (document.getElementById('cmp-nav-btn')) return true;
    const userChip = document.querySelector('.lr-user-chip');
    if (!userChip) return false;

    // "My Skills" button
    const myBtn = document.createElement('button');
    myBtn.id = 'cmp-nav-myskills';
    myBtn.className = 'cmp-nav-btn green';
    myBtn.textContent = '📦 我的插件';
    myBtn.addEventListener('click', () => { if (requireAuth()) createMySkillsModal(); });
    userChip.parentNode.insertBefore(myBtn, userChip);

    // "Publish" button
    const pubBtn = document.createElement('button');
    pubBtn.id = 'cmp-nav-btn';
    pubBtn.className = 'cmp-nav-btn';
    pubBtn.textContent = '➕ 发布技能';
    pubBtn.addEventListener('click', () => { if (requireAuth()) createPublishModal(); });
    userChip.parentNode.insertBefore(pubBtn, userChip);

    return true;
  }

  // ── Init ──
  function init() {
    injectStyles();
    const observer = new MutationObserver(() => {
      addNavButtons();
      addPreviewButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
