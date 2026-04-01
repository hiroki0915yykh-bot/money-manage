// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered successfully.', reg))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {

    // --- 初期データの設定（固定費のモック） ---
    const defaultFixed = [
        { id: 1, name: '家賃', amount: 80000 },
        { id: 2, name: 'Netflix', amount: 1490 }
    ];
    
    if (!localStorage.getItem('budget_fixed')) {
        localStorage.setItem('budget_fixed', JSON.stringify(defaultFixed));
    }
    if (!localStorage.getItem('budget_variable')) {
        localStorage.setItem('budget_variable', JSON.stringify([]));
    }

    // --- DOM 要素の取得 ---
    const totalAmountEl = document.getElementById('total-amount');
    const fixedTotalEl = document.getElementById('fixed-total');
    const variableTotalEl = document.getElementById('variable-total');
    const progressBarEl = document.getElementById('progress-bar');
    
    const expenseInput = document.getElementById('expense-input');
    const submitBtn = document.getElementById('submit-btn');
    const feedbackMsg = document.getElementById('feedback-msg');
    
    const expenseList = document.getElementById('expense-list');
    const fixedList = document.getElementById('fixed-list');

    // モーダル用DOM
    const settingsModal = document.getElementById('settings-modal');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const editFixedList = document.getElementById('edit-fixed-list');
    const fixedNameInput = document.getElementById('fixed-name-input');
    const fixedAmountInput = document.getElementById('fixed-amount-input');
    const addFixedBtn = document.getElementById('add-fixed-btn');

    // --- 数値のフォーマット ---
    const formatMoney = (num) => {
        return num.toLocaleString('ja-JP');
    };

    // --- データの描画 ---
    const renderDashboard = () => {
        const fixedExpenses = JSON.parse(localStorage.getItem('budget_fixed')) || [];
        const variableExpenses = JSON.parse(localStorage.getItem('budget_variable')) || [];

        // 合計計算
        const fixedTotal = fixedExpenses.reduce((sum, item) => sum + item.amount, 0);
        const variableTotal = variableExpenses.reduce((sum, item) => sum + item.amount, 0);
        const grandTotal = fixedTotal + variableTotal;

        // ダッシュボード更新
        totalAmountEl.innerText = formatMoney(grandTotal);
        fixedTotalEl.innerText = '¥' + formatMoney(fixedTotal);
        variableTotalEl.innerText = '¥' + formatMoney(variableTotal);

        // プログレスバー（予算20万仮定）
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
        if(fixedExpenses.length === 0){
             fixedList.innerHTML = '<li style="color:var(--text-secondary);font-size:14px;">設定から登録してください</li>';
        } else {
             fixedExpenses.forEach(item => {
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
        const sortedVariables = [...variableExpenses].reverse();
        if (sortedVariables.length === 0) {
            expenseList.innerHTML = '<li style="color:var(--text-secondary);font-size:14px;">まだ記録がありません</li>';
        } else {
            sortedVariables.slice(0, 5).forEach(item => { 
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="item-info">
                        <span class="item-name">${item.name}</span>
                        <span class="item-date">${item.date}</span>
                    </div>
                    <span class="item-price">¥${formatMoney(item.amount)}</span>
                `;
                expenseList.appendChild(li);
            });
        }
    };

    // --- 固定費設定モーダルのリスト描画 ---
    const renderSettingsList = () => {
        const fixedExpenses = JSON.parse(localStorage.getItem('budget_fixed')) || [];
        editFixedList.innerHTML = '';
        
        if(fixedExpenses.length === 0){
             editFixedList.innerHTML = '<li style="color:var(--text-secondary);font-size:14px;">登録された固定費はありません</li>';
        }

        fixedExpenses.forEach(item => {
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

        // 削除ボタンのイベントリスナー登録
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.getAttribute('data-id'), 10);
                deleteFixedExpense(id);
            });
        });
    };

    // --- 固定費の追加処理 ---
    const addFixedExpense = () => {
        const name = fixedNameInput.value.trim();
        const amountStr = fixedAmountInput.value.trim();
        const amount = parseInt(amountStr, 10);

        if (name && !isNaN(amount)) {
            const fixedExpenses = JSON.parse(localStorage.getItem('budget_fixed')) || [];
            fixedExpenses.push({
                id: Date.now(),
                name: name,
                amount: amount
            });
            localStorage.setItem('budget_fixed', JSON.stringify(fixedExpenses));
            
            // 入力リセットと再描画
            fixedNameInput.value = '';
            fixedAmountInput.value = '';
            renderSettingsList();
            renderDashboard();
        }
    };

    // --- 固定費の削除処理 ---
    const deleteFixedExpense = (id) => {
        let fixedExpenses = JSON.parse(localStorage.getItem('budget_fixed')) || [];
        fixedExpenses = fixedExpenses.filter(item => item.id !== id);
        localStorage.setItem('budget_fixed', JSON.stringify(fixedExpenses));
        renderSettingsList();
        renderDashboard();
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
                        id: Date.now() + Math.random(),
                        name: name,
                        amount: amount,
                        date: today
                    });
                }
            }
        });
        return newEntries;
    };

    // --- イベントリスナー ---
    // 変動費の登録
    submitBtn.addEventListener('click', () => {
        const inputText = expenseInput.value;
        const parsedItems = parseInput(inputText);

        if (parsedItems.length > 0) {
            const currentVariables = JSON.parse(localStorage.getItem('budget_variable')) || [];
            localStorage.setItem('budget_variable', JSON.stringify([...currentVariables, ...parsedItems]));
            
            renderDashboard();

            expenseInput.value = '';
            feedbackMsg.innerText = `${parsedItems.length}件の支出を登録しました！`;
            feedbackMsg.classList.remove('hidden');
            setTimeout(() => { feedbackMsg.classList.add('hidden'); }, 3000);
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

    // モーダル開閉
    openSettingsBtn.addEventListener('click', () => {
        renderSettingsList();
        settingsModal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    // モーダル外クリックで閉じる
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });

    // 固定費追加ボタン
    addFixedBtn.addEventListener('click', addFixedExpense);

    // 初回描画
    renderDashboard();
});
