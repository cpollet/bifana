bifana-web:
	docker build . -t cpollet/bifana-web

push: bifana-web
	docker push cpollet/bifana-web

start: bifana-web
	docker-compose up -d
stop:
	docker-compose down

clean: stop
	docker-compose rm

clean_db: stop
	docker volume rm -f bifana_influxdb-data

clean_all: clean_db
	docker volume rm -f bifana_grafana-data

logs:
	docker-compose logs -f