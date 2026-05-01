from flask import Flask, render_template

# Создаем экземпляр приложения
app = Flask(__name__)

# Определяем маршрут для главной страницы
@app.route('/')
def main():
    return render_template('main.html')

# Запускаем приложение
if __name__ == '__main__':
    app.run(debug=True)