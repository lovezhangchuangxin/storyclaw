use std::io::{self, Write};

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use sqlx::PgPool;
use uuid::Uuid;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost:5432/storyclaw".to_string());

    print!("管理员邮箱: ");
    io::stdout().flush()?;
    let mut email = String::new();
    io::stdin().read_line(&mut email)?;
    let email = email.trim().to_string();

    if email.is_empty() || !email.contains('@') {
        anyhow::bail!("请输入有效的邮箱地址");
    }

    print!("密码 (至少6位): ");
    io::stdout().flush()?;
    let mut password = String::new();
    io::stdin().read_line(&mut password)?;
    let password = password.trim().to_string();

    if password.len() < 6 {
        anyhow::bail!("密码至少需要6个字符");
    }

    let pool = PgPool::connect(&database_url).await?;

    let existing = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE email = $1")
        .bind(&email)
        .fetch_one(&pool)
        .await?;

    if existing > 0 {
        sqlx::query("UPDATE users SET role = 'admin' WHERE email = $1")
            .bind(&email)
            .execute(&pool)
            .await?;
        println!("\n✅ 已将 {} 升级为管理员", email);
    } else {
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| anyhow::anyhow!(e.to_string()))?
            .to_string();

        sqlx::query(
            "INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, 'admin')",
        )
        .bind(Uuid::new_v4())
        .bind(&email)
        .bind(&hash)
        .execute(&pool)
        .await?;

        println!("\n✅ 已创建管理员账号: {}", email);
    }

    Ok(())
}
