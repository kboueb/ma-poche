//! Verrouillage de l'app par Touch ID (ou mot de passe de session en secours), via LocalAuthentication.

/// Vrai si le Mac peut authentifier son propriétaire (Touch ID ou mot de passe).
#[tauri::command]
pub fn touchid_available() -> bool {
    imp::available()
}

/// Demande Touch ID ; renvoie une erreur lisible si l'utilisateur annule ou échoue.
#[tauri::command]
pub async fn touchid_authenticate(reason: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || imp::authenticate(&reason))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(target_os = "macos")]
mod imp {
    use block2::RcBlock;
    use objc2::runtime::Bool;
    use objc2_foundation::{NSError, NSString};
    use objc2_local_authentication::{LAContext, LAPolicy};
    use std::sync::mpsc;

    // Touch ID, avec repli sur le mot de passe de session (Mac sans capteur, doigt non reconnu…)
    const POLICY: LAPolicy = LAPolicy::DeviceOwnerAuthentication;

    pub fn available() -> bool {
        let ctx = unsafe { LAContext::new() };
        unsafe { ctx.canEvaluatePolicy_error(POLICY) }.is_ok()
    }

    pub fn authenticate(reason: &str) -> Result<(), String> {
        let ctx = unsafe { LAContext::new() };
        let (tx, rx) = mpsc::channel::<Result<(), String>>();
        let reply = RcBlock::new(move |ok: Bool, err: *mut NSError| {
            let res = if ok.as_bool() {
                Ok(())
            } else if let Some(err) = unsafe { err.as_ref() } {
                Err(format!("{}:{}", err.code(), err.localizedDescription()))
            } else {
                Err("unknown".into())
            };
            let _ = tx.send(res);
        });
        unsafe { ctx.evaluatePolicy_localizedReason_reply(POLICY, &NSString::from_str(reason), &reply) };
        // Le contexte doit vivre jusqu'à la réponse (appelée sur une file système)
        let res = rx.recv().unwrap_or_else(|_| Err("no-reply".into()));
        drop(ctx);
        res
    }
}

#[cfg(not(target_os = "macos"))]
mod imp {
    pub fn available() -> bool {
        false
    }
    pub fn authenticate(_reason: &str) -> Result<(), String> {
        Err("unsupported".into())
    }
}
