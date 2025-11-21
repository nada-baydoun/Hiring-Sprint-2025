# 🚗 AI-Powered Vehicle Condition Assessment — Hiring Sprint

Thank you for the amazing opportunity. I have enjoyed working on this project to the max.
If I had more time, I would scale my app to make it more realistic, and for that I mean:
1.	We should first check if the car image before / after belong to the same car
2.	We need more input images (views) from the car owner, such that all the car features are present in our hand
3.	We should ask the user for 5 views as well to make sure that everything is covered.
4.	The next step will be to map each view of the before to the after
5.	We need an additional AI model that can map the location of the damage from the after image to the before image
6.	In case the owner rented a car that was already damaged, the damages should not be accounted for the customer as additional costs
7.	We need a real database where the car information is all inside (year of manufacture, type, ...)
8.	We need to detect the car element that was damaged as well
9.	We should train a model from scratch with the real damages that can happen and that need an application (if a car bumps into a tree, there is no room for subjectivity, and this should not require AI to check the severity and detect the damage; we only need calculations and the cost)
10.	Connecting to a real database is required so that we can estimate the costs in real time
11.	other than the damage class and severity, we should check the damage size and this will need estimation on the size of the car and for that we can either refer to the rental owner, or take always the car image from the rental owner with a reference object so that we can scale, or simply refer to the additional information given in the CSV
12.	(VERY OPTIONAL AND ONLY BECAUSE I WORK IN 3D RECONSTRUCTION), we can build a 3D model out of the 5 views and compare both models to know the damages added.
You can check my demo here: https://youtu.be/t0WDqQFUAH4
If you wish to try the demo yourself, here are the weights that should be added in ai-backend (same level as main.py): https://drive.google.com/drive/folders/1xvFl1R6eh_6lO4xMlpYx4ToBF3wgdBxE?usp=sharing
