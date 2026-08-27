(function(){
  const style = document.createElement('style');
  style.textContent = `
    .claim-toast{position:fixed;right:22px;bottom:22px;z-index:10000;max-width:360px;background:#171a24;color:#fff;border:1px solid #9b6bff;border-left:4px solid #9b6bff;border-radius:12px;padding:14px 16px;box-shadow:0 14px 35px rgba(0,0,0,.45);font-family:'Segoe UI',Roboto,Arial,sans-serif;animation:claim-toast-in .18s ease-out}
    .claim-toast strong{display:block;color:#c19aff;font-size:14px;margin-bottom:4px}
    .claim-toast span{display:block;color:#c6c9d3;font-size:12px;line-height:1.45}
    @keyframes claim-toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    .claim-box{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:9999}
    .claim-card{background:#171a24;color:#fff;border:1px solid #9b6bff;border-radius:14px;padding:26px;max-width:520px;width:calc(100% - 32px);text-align:center;box-shadow:0 18px 60px rgba(0,0,0,.5)}
    .claim-card h3{font-size:19px;margin:0 0 9px}
    .claim-card p{color:#c6c9d3;font-size:13px;line-height:1.55;margin:0 0 10px}
    .claim-timer{font-size:44px;font-weight:800;color:#f0c674;margin:16px}
    .claim-actions{display:grid;gap:9px}
    .claim-actions button{padding:11px 14px;border:0;border-radius:7px;cursor:pointer;font-weight:700;text-align:left}
    .claim-ok{background:#50c878}.claim-no{background:#e2574c;color:#fff}.claim-alt{background:#343b50;color:#fff}
  `;
  document.head.appendChild(style);

  let seen = '';

  const formatTime = (milliseconds) => {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  };

  const showClaimToast = (title, message) => {
    const toast = document.createElement('div');
    toast.className = 'claim-toast';
    toast.innerHTML = '<strong>' + title + '</strong><span>' + message + '</span>';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  };

  const createClaimDialog = (content) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'claim-box';
    wrapper.innerHTML = '<div class="claim-card">' + content + '</div>';
    document.body.appendChild(wrapper);
    return wrapper;
  };

  async function checkClaims(){
    try{
      await belobraExpireClaims();
      const queue = await belobraLoadRespawnQueue(respawnId);
      if(!queue.active) return;

      const { data: activeRow } = await supabaseClient
        .from('queue_entries')
        .select('queued_by_profile_id,characters(profile_id)')
        .eq('id', queue.active.id)
        .single();

      const activeOwner = activeRow?.queued_by_profile_id || activeRow?.characters?.profile_id;
      const claims = await belobraGetOpenClaims(respawnId);
      const user = await belobraGetUser();

      for(const claim of claims){
        const isClaimer = !!user && claim.claimer_profile_id === user.id;
        const isClaimTarget = !!user && activeOwner === user.id;
        if(!isClaimer && !isClaimTarget) continue;

        const claimKey = claim.id + (isClaimer ? '-claimer' : '-target');
        if(seen === claimKey) continue;
        seen = claimKey;

        const deadline = new Date(claim.response_deadline).getTime();

        // Quem enviou o Claim recebe apenas um aviso discreto e não bloqueante.
        if(isClaimer){
          showClaimToast('Claim enviado', 'O jogador atual foi avisado e responderá dentro da janela de 10 minutos.');
          continue;
        }

        // Somente o jogador reivindicado recebe esta janela bloqueante de decisão.
        const dialog = createClaimDialog(
          '<h3>Claim recebido</h3>' +
          '<p>Escolha uma opção. Você tem 10 minutos para responder.</p>' +
          '<div class="claim-timer"></div>' +
          '<div class="claim-actions">' +
            '<button class="claim-ok" data-decision="ten_minutes_return_queue">Usar 10 minutos e voltar para a fila</button>' +
            '<button class="claim-alt" data-decision="leave_now_return_queue">Sair agora e voltar para a fila</button>' +
            '<button class="claim-alt" data-decision="ten_minutes_leave_queue">Usar 10 minutos e sair da fila</button>' +
            '<button class="claim-no" data-decision="leave_now_leave_queue">Sair agora e sair da fila</button>' +
          '</div>'
        );

        const timer = dialog.querySelector('.claim-timer');
        const interval = setInterval(() => {
          timer.textContent = formatTime(deadline - Date.now());
          if(Date.now() >= deadline){
            clearInterval(interval);
            dialog.remove();
            seen = '';
          }
        }, 500);

        dialog.querySelectorAll('[data-decision]').forEach((button) => {
          button.onclick = async () => {
            button.disabled = true;
            try{
              await belobraResolveClaim(claim.id, button.dataset.decision);
              clearInterval(interval);
              dialog.remove();
              seen = '';
            }catch(error){
              button.disabled = false;
              showClaimToast('Não foi possível responder', error.message || 'Tente novamente.');
            }
          };
        });
        break;
      }
    }catch(error){
      console.warn('Claim', error);
    }
  }

  setInterval(checkClaims, 3000);
})();
