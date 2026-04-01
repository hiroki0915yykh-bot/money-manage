// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

document.addEventListener('DOMContentLoaded', async () => {

    const appContainer = document.getElementById('app-container');
    const setupContainer = document.getElementById('setup-container');

    // === 魔法のリンク（マジックリンク）の受け取り処理 ===
    const urlParams = new URLSearchParams(window.location.search);
    const paramUrl = urlParams.get('db_url');
    const paramKey = urlParams.get('db_key');

    if (paramUrl && paramKey) {
        // キーをブラウザに隠して保存
        localStorage.setItem('supabase_url', paramUrl);
        localStorage.setItem('supabase_key', paramKey);
        // セキュリティのため、URL欄からキーの文字を消し去る
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const supabaseUrl = localStorage.getItem('supabase_url');
    const supabaseKey = localStorage.getItem('supabase_key');
    let supabase = null;

    if (supabaseUrl && supabaseKey) {
        // データベース接続準備
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        appContainer.style.display = 'block';
    } else {
        // キーがない場合はエラー画面
        setupContainer.style.display = 'block';
        return; // 以後の処理を止める
    }

    // --- DOM 要素の取得 ---
    const totalAmountEl = document.getElementById('total-amount');
    const fixedTotalEl = document.getElementById('fixed-total');
    const variableTotalEl = document.getElementById('variable-total');
    const progressBarEl = document.getElementById('progress-bar');
    const syncStatusEl = document.getElementById('sync-status');
    
    const expenseInput = document.getElementById('expense-input');
    const submitBtn = document.getElementById('submit-btn');
    const feedbackMsg = document.getElementById('feedback-msg');
    
    const expenseList = document.getElementById('expense-list');
    const fixedList = document.getElementById('fixed-list');

    // モーダル用DOM（固定費）
    const settingsModal = document.getElementById('settings-modal');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const editFixedList = document.getElementById('edit-fixed-list');
    const fixedNameInput = document.getElementById('fixed-name-input');
    const fixedAmountInput = document.getElementById('fixed-amount-input');
    const addFixedBtn = document.getElementById('add-fixed-btn');

    // モーダル用DOM（変動費の編集・削除用）
    const editVarModal = document.getElementById('edit-variable-modal');
    const closeVarModalBtn = document.getElementById('close-var-modal-btn');
    const editVarNameInput = document.getElementById('edit-var-name-input');
    const editVarAmountInput = document.getElementById('edit-var-amount-input');
    const editVarIdInput = document.getElementById('edit-var-id-input');
    const saveVarBtn = document.getElementById('save-var-btn');
    const deleteVarBtn = document.getElementById('delete-var-btn');

    // --- 状態管理 ---
    let currentFixedExpenses = [];
    let currentVariableExpenses = [];

    // --- 数値のフォーマット ---
    const formatMoney = (num) => {
        return num.toLocaleString('ja-JP');
    };

    const updateSyncStatus = (message, isError = false) => {
        syncStatusEl.innerText = message;
        syncStatusEl.style.color = isError ? 'var(--danger-color)' : 'var(--success-color)';
    };

    // --- Supabaseからデータを取得してダッシュボードを描画 ---
    const renderDashboard = async () => {
        updateSyncStatus('☁️同期中...');
        
        // データの取得
        const { data: fixedData, error: fixedErr } = await supabase.from('fixed_expenses').select('*');
        const { data: varData, error: varErr } = await supabase.from('variable_expenses').select('*').order('created_at', { ascending: false });

        if (fixedErr || varErr) {
            updateSyncStatus('❌通信エラー', true);
            console.error(fixedErr, varErr);
            return;
        }

        currentFixedExpenses = fixedData || [];
        currentVariableExpenses = varData || [];

        // 合計計算
        const fixedTotal = currentFixedExpenses.reduce((sum, item) => sum + item.amount, 0);
        const variableTotal = currentVariableExpenses.reduce((sum, item) => sum + item.amount, 0);
        const grandTotal = fixedTotal + variableTotal;

        // ダッシュボード更新
        totalAmountEl.innerText = formatMoney(grandTotal);
        fixedTotalEl.innerText = '¥' + formatMoney(fixedTotal);
        variableTotalEl.innerText = '¥' + formatMoney(variableTotal);

        // プログレスバー
        const budget = 200000;
        const progressPercentage = Math.min((grandTotal / budget) * 100, 100);
        progressBarEl.style.width = progressPercentage + '%';
        if (progressPercentage > 90) {
            progressBarEl.style.background = 'var(--danger-color)';
        } else {
            progressBarEl.style.background = 'var(--accent-gradient)';
        }

        // ホームの固定費リスト描画
        fixedList.innerHTML = '';
        if(currentFixedExpenses.length === 0){
             fixedList.innerHTML = '<li style="color:var(--text-secondary);font-size:14px;">設定から登録してください</li>';
        } else {
             currentFixedExpenses.forEach(item => {
                 const li = document.createElement('li');
                 li.innerHTML = `
                     <div class="item-info">
                         <span class="item-name">${item.name}</span>
                     </div>
                     <span class="item-price">¥${formatMoney(item.amount)}</span>
                 `;
                 fixedList.appendChild(li);
             });
        }

        // 変動費リストの描画
        expenseList.innerHTML = '';
        if (currentVariableExpenses.length === 0) {
            expenseList.innerHTML = '<li style="color:var(--text-secondary);font-size:14px;">まだ記録がありません</li>';
        } else {
            currentVariableExpenses.slice(0, 5).forEach(item => { // 最新5件表示
                const li = document.createElement('li');
                li.className = 'clickable-item';
                li.setAttribute('data-id', item.id);
                li.innerHTML = `
                    <div class="item-info pointer-events-none">
                        <span class="item-name pointer-events-none">${item.name}</span>
                        <span class="item-date pointer-events-none">${item.date}</span>
                    </div>
                    <span class="item-price pointer-events-none">¥${formatMoney(item.amount)}</span>
                `;
                li.addEventListener('click', () => openEditVarModal(item.id));
                expenseList.appendChild(li);
            });
        }

        updateSyncStatus('☁️同期完了');
    };

    // --- 固定費設定モーダルのリスト描画 ---
    const renderSettingsList = () => {
        editFixedList.innerHTML = '';
        if(currentFixedExpenses.length === 0){
             editFixedList.innerHTML = '<li style="color:var(--text-secondary);font-size:14px;">登録された固定費はありません</li>';
        }

        currentFixedExpenses.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="item-info" style="flex:1;">
                    <span class="item-name" style="font-size: 14px;">${item.name}</span>
                    <span class="item-price" style="font-size: 14px; font-weight: normal; margin-top: 4px;">¥${formatMoney(item.amount)}</span>
                </div>
                <button class="delete-btn" data-id="${item.id}">削除</button>
            `;
            editFixedList.appendChild(li);
        });

        // 削除ボタンのイベント
        document.querySelectorAll('#edit-fixed-list .delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                updateSyncStatus('☁️削除中...');
                await supabase.from('fixed_expenses').delete().eq('id', id);
                renderDashboard().then(() => renderSettingsList());
            });
        });
    };

    // --- 固定費の追加処理 ---
    const addFixedExpense = async () => {
        const name = fixedNameInput.value.trim();
        const amountStr = fixedAmountInput.value.trim();
        const amount = parseInt(amountStr, 10);

        if (name && !isNaN(amount)) {
            updateSyncStatus('☁️保存中...');
            await supabase.from('fixed_expenses').insert([{ 
                id: Date.now().toString(), 
                name, 
                amount 
            }]);
            
            fixedNameInput.value = '';
            fixedAmountInput.value = '';
            renderDashboard().then(() => renderSettingsList());
        }
    };

    // --- メモ解析（自然言語の一括解析）機能 ---
    const parseInput = (text) => {
        const lines = text.split('\n');
        const newEntries = [];
        const today = new Date().toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });

        lines.forEach(line => {
            const trimmed = line.trim();
            if(!trimmed) return;
            
            const match = trimmed.match(/^(.+?)[ 　]*([0-9０-９,]+)円?$/);
            if(match) {
                const name = match[1].trim();
                let amountStr = match[2].replace(/,/g, '');
                amountStr = amountStr.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
                
                const amount = parseInt(amountStr, 10);
                if (!isNaN(amount)) {
                    newEntries.push({
                        id: (Date.now() + Math.random()).toString(),
                        name: name,
                        amount: amount,
                        date: today
                    });
                }
            }
        });
        return newEntries;
    };

    // --- 変動費の編集機能（モーダル開く） ---
    const openEditVarModal = (id) => {
        const target = currentVariableExpenses.find(item => item.id === id);
        if(!target) return;

        editVarIdInput.value = target.id;
        editVarNameInput.value = target.name;
        editVarAmountInput.value = target.amount;

        editVarModal.classList.remove('hidden');
    };

    // 変動費の保存（編集完了）
    saveVarBtn.addEventListener('click', async () => {
        const id = editVarIdInput.value;
        const name = editVarNameInput.value.trim();
        const amount = parseInt(editVarAmountInput.value.trim(), 10);

        if(name && !isNaN(amount)) {
            submitBtn.disabled = true;
            updateSyncStatus('☁️更新中...');
            await supabase.from('variable_expenses').update({ name, amount }).eq('id', id);
            
            editVarModal.classList.add('hidden');
            await renderDashboard();
            submitBtn.disabled = false;
        }
    });

    // 変動費の削除
    deleteVarBtn.addEventListener('click', async () => {
        const id = editVarIdInput.value;
        submitBtn.disabled = true;
        updateSyncStatus('☁️削除中...');
        await supabase.from('variable_expenses').delete().eq('id', id);

        editVarModal.classList.add('hidden');
        await renderDashboard();
        submitBtn.disabled = false;
    });

    // モーダル外クリックで各種モーダルを閉じる
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
        if (e.target === editVarModal) {
            editVarModal.classList.add('hidden');
        }
    });

    // 変動費の新規登録機能(ざっくり入力)
    submitBtn.addEventListener('click', async () => {
        const inputText = expenseInput.value;
        const parsedItems = parseInput(inputText);

        if (parsedItems.length > 0) {
            submitBtn.disabled = true;
            updateSyncStatus('☁️保存中...');
            // DBへInsert
            const { error } = await supabase.from('variable_expenses').insert(parsedItems);

            if (!error) {
                await renderDashboard();
                expenseInput.value = '';
                feedbackMsg.innerText = `${parsedItems.length}件の支出を登録しました！`;
                feedbackMsg.classList.remove('hidden');
                setTimeout(() => { feedbackMsg.classList.add('hidden'); }, 3000);
            } else {
                alert('クラウドへの保存に失敗しました。');
                console.error(error);
            }
            submitBtn.disabled = false;
        } else {
            feedbackMsg.innerText = 'エラー：書式が不正です (例: スタバ 500)';
            feedbackMsg.style.color = 'var(--danger-color)';
            feedbackMsg.style.background = 'rgba(255, 75, 75, 0.1)';
            feedbackMsg.classList.remove('hidden');
            setTimeout(() => {
                feedbackMsg.classList.add('hidden');
                feedbackMsg.style.color = 'var(--success-color)';
                feedbackMsg.style.background = 'rgba(0, 230, 118, 0.1)';
            }, 3000);
        }
    });

    // 固定費設定モーダル開閉
    openSettingsBtn.addEventListener('click', () => {
        renderSettingsList();
        settingsModal.classList.remove('hidden');
    });
    closeModalBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    // 変動費設定モーダル閉じる
    closeVarModalBtn.addEventListener('click', () => {
        editVarModal.classList.add('hidden');
    });

    // 固定費追加ボタン
    addFixedBtn.addEventListener('click', addFixedExpense);

    // 初回実行
    renderDashboard();
});
