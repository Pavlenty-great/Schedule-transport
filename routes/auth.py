from flask import Blueprint, render_template, request, redirect, url_for, session
from db import get_db_connection
import psycopg2.extras

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        login = request.form.get('login', '').strip()
        password = request.form.get('password', '').strip()
        
        if not login or not password:
            return render_template('login.html', error='Введите логин и пароль')
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        try:
            cur.execute("""
                SELECT u.id, u.name, u.surname, u.login, u.password, r.name as role
                FROM "Users" u
                JOIN "Users_roles" ur ON u.id = ur.user_id
                JOIN "Roles" r ON ur.role_id = r.id
                WHERE u.login = %s
            """, (login,))
            
            user = cur.fetchone()
            
            if user and user['password'] == password:
                session['user_id'] = user['id']
                session['user_name'] = f"{user['name']} {user['surname']}"
                session['login'] = user['login']
                session['role'] = user['role']
                
                cur.close()
                conn.close()
                
                return redirect(url_for('main.main'))
            else:
                return render_template('login.html', error='Неверный логин или пароль')
            
        except Exception as e:
            print(f"Ошибка авторизации: {e}")
            return render_template('login.html', error='Ошибка при входе в систему')
        finally:
            cur.close()
            conn.close()
    
    return render_template('login.html')


@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('main.main'))