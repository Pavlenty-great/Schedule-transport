from flask import Flask, render_template
import psycopg2
import os
from dotenv import load_dotenv

# Создаем экземпляр приложения
app = Flask(__name__)

load_dotenv()

def get_db_connection():
    #conn = psycopg2.connect(**DB_CONFIG)
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD')
    )
    return conn

conn = get_db_connection()
cur = conn.cursor()
cur.execute('select * from "Routes"')
routes = cur.fetchall()
cur.close()
conn.close()
print(f'Найдено {len(routes)} маршрутов')

# Определяем маршрут для главной страницы
@app.route('/')
def main():
    return render_template('main.html')

# Запускаем приложение
if __name__ == '__main__':
    app.run(debug=True)
