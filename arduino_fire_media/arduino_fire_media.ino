#if defined(ESP32)
#include <analogWrite.h>
#endif

#if defined(ESP8266)
#include <ESP8266WiFi.h>
#else
#include <WiFi.h>
#endif
#include <PubSubClient.h>

const char* ssid = "VM712429A";
const char* password =  "tBhj6Hxe7abj";
const char* mqttServer = "192.168.0.11";
const int mqttPort = 1883;
const char* mqttUser = "";
const char* mqttPassword = "";
 
WiFiClient wifiClient;
PubSubClient client(wifiClient); //lib required for mqtt

int FIRE_PIN = 16;
int MEDIA_PIN = 4;
int connectionTries = 0;


void WIFI_Connect()
{
  WiFi.disconnect();
      WiFi.begin(ssid, password);
      Serial.print("Wifi Status:");
      Serial.println(WiFi.status());
      while (WiFi.status() != WL_CONNECTED) {
          delay(500);          
        Serial.println("Connecting to WiFi..");
        connectionTries = connectionTries + 1;
        if (connectionTries>20){
          connectionTries = 0;
           Serial.println("aborting connection...");
           return;
        }
      }
      Serial.println("Connected to the WiFi network");

  client.setServer(mqttServer, mqttPort);
  client.setCallback(callback); 
  while (!client.connected()) {
    Serial.println("Connecting to MQTT..."); 
    if (client.connect("ESPDownStairsClient", mqttUser, mqttPassword )) { 
      Serial.println("connected");   
    } else { 
      Serial.print("failed with state ");
      Serial.print(client.state());
      delay(2000); 
    }
  } 
  client.publish("livingroom/fire", "Hello from ESPXXX");
  client.publish("livingroom/media", "Hello from ESPXXX");
  client.subscribe("livingroom/fire/state");
  client.subscribe("livingroom/media/state");
}


void setup() {
  pinMode(FIRE_PIN, OUTPUT);
  pinMode(MEDIA_PIN, OUTPUT);
  digitalWrite(FIRE_PIN, HIGH); 
  digitalWrite(MEDIA_PIN, HIGH); 
  Serial.begin(115200);
  WIFI_Connect(); 
}
 
void callback(char* topic, byte* payload, unsigned int length) {
 
  Serial.print("Message arrived in topic: ");
  Serial.println(topic);
 
  Serial.print("Message:");
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
 
  Serial.println();
  Serial.println("-----------------------");

  if (strncmp(topic, "livingroom/fire/state", strlen("livingroom/fire/state")) == 0) {  
      if (!strncmp((char *)payload, "on", length)) {
                 digitalWrite(FIRE_PIN, LOW); 
        } else if (!strncmp((char *)payload, "off", length)) {
            digitalWrite(FIRE_PIN, HIGH); 
        }
    }
  else  if (strncmp(topic, "livingroom/media/state", strlen("livingroom/media/state")) == 0) {  
      if (!strncmp((char *)payload, "on", length)) {
                 digitalWrite(MEDIA_PIN, LOW); 
        } else if (!strncmp((char *)payload, "off", length)) {
            digitalWrite(MEDIA_PIN, HIGH); 
        }
    }
}
 
void loop() {
  if (WiFi.status() != WL_CONNECTED)
    {
       WIFI_Connect();
       return;       
   }
   if (!client.connected()) {
      WIFI_Connect();
      return;
   }
  client.loop();

  
}
